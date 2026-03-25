import { WebSocketServer } from 'ws';
import { MATCH_STATUS, SOCKET_MESSAGE_TYPE, SOCKET_SENDER, USER_ROLE } from '../utils/enum.js';
import bullmqService from './bullmq.service.js';
import { sandboxSocketRateLimit, socketRateLimit } from '../middlewares/socketratelimit.middleware.js';
import redisClient from '../configs/redis.config.js';
import { verifyToken } from '../utils/authtoken.js';
import { userSessionKey } from '../utils/rediskeys.js';
import matchModel from '../models/match.model.js';
import { logInfo } from '../utils/logger.js';

// Parse a raw cookie header string into a key-value object
const parseCookies = (cookieHeader = "") =>
    Object.fromEntries(
        cookieHeader.split(";")
            .map((c) => c.trim().split("="))
            .filter(([k]) => k)
            .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join("=").trim())])
    );

const formatMatchState = (matchState) => {

    return {
        team1: matchState.team1.split(":")[1],
        team2: matchState.team2.split(":")[1],
        topic: matchState.topic,
        description: matchState.description,
        round: matchState.round,
        finishTime: matchState.finishTime ? Number(matchState.finishTime) : 0,
        pros: matchState.pros,
        cons: matchState.cons,
        turn: matchState.turn,
        status: matchState.status,
        remainingTime: matchState.remainingTime ? Number(matchState.remainingTime) : 0,
    }
}


const buildSocketEnvelope = ({ type, data = {}, from = SOCKET_SENDER.SYSTEM }) => {
    const validSenders = Object.values(SOCKET_SENDER);
    const sender = validSenders.includes(from) ? from : SOCKET_SENDER.SYSTEM;
    const timestamp = new Date().toISOString();
    return {
        type,
        from: sender,
        timestamp,
        data: { ...data },
    };
};

const resolveSocketSender = (value) => {
    if (value === SOCKET_SENDER.TEAM1) return SOCKET_SENDER.TEAM1;
    if (value === SOCKET_SENDER.TEAM2) return SOCKET_SENDER.TEAM2;
    if (value === SOCKET_SENDER.ADMIN) return SOCKET_SENDER.ADMIN;
    return SOCKET_SENDER.SYSTEM;
};

const sendSocketMessage = (ws, payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
};

const MAX_MESSAGE_SIZE = Number(process.env.SOCKET_MAX_MESSAGE_SIZE || 1024 * 5); // 5KB
const MAX_CHAT_MESSAGE_SIZE = Number(process.env.SOCKET_MAX_CHAT_MESSAGE_SIZE || 1024 * 2); // 2KB
const SOCKET_MESSAGE_LIMIT = Number(process.env.SOCKET_MESSAGE_LIMIT || 5); // max messages per window per user
const SOCKET_WINDOW_TIME = Number(process.env.SOCKET_WINDOW_TIME_SEC || 2 * 60); // 2-minute window for messages

const SANDBOX_MSG_LIMIT = Number(process.env.SANDBOX_MSG_LIMIT || 8); // max messages per sandbox window
const SANDBOX_MSG_WINDOW = Number(process.env.SANDBOX_MSG_WINDOW_SEC || 600); // 10-minute window (seconds)
const SANDBOX_DURATION = Number(process.env.SANDBOX_DURATION_MS || 600000); // auto-disconnect after 10 min (ms)

class SocketService {

    constructor() {
        this.wss = null;
        this.sandboxWss = null;
        this.socketStore = new Map();
        this.timerStore = new Map();
    }

    init(server) {
        this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_SIZE });
        this.sandboxWss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_SIZE });

        server.on('upgrade', async (request, socket, head) => {

            try {
                const reqUrl = new URL(request.url, `http://${request.headers.host}`);

                // Only handle /ws — reject everything else immediately
                if (reqUrl.pathname !== "/ws" && reqUrl.pathname !== "/ws-sandbox") {
                    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                    socket.destroy();
                    return;
                }

                if(reqUrl.pathname === "/ws-sandbox"){

                    const payloadKey = reqUrl.searchParams.get("payload");

                    if(!payloadKey){
                        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                        socket.destroy();
                        return;
                    }


                    let decoded;
                    try {
                        decoded = verifyToken(payloadKey);
                    } catch {
                        console.log('Failed to verify sandbox token');
                        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                        socket.destroy();
                        return;
                    }

                    if(decoded.type !== "sandbox"){
                        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                        socket.destroy();
                        return;
                    }
                    const userId = String(decoded.sub);

                    const allowed = await sandboxSocketRateLimit(userId, SANDBOX_MSG_LIMIT, SANDBOX_MSG_WINDOW);

                    if (!allowed) {
                        socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
                        socket.destroy();
                        return;
                    }

                    // If valid, upgrade to sandbox WS and wire up the connection
                    this.sandboxWss.handleUpgrade(request, socket, head, (ws) => {
                        ws.user = {
                            id: userId,
                            username: `sandbox_user_${userId.slice(-4)}`,
                            role: 'sandbox',
                            authType: 'passkey',
                        };
                        this.sandboxWss.emit('connection', ws, request);
                    });
                    return; // prevent fall-through to /ws auth logic
                }

                const matchId = reqUrl.searchParams.get("matchId");

                // ── Auth: passkey (query param) OR access_token (cookie) ──────────────
                const passkeyParam = reqUrl.searchParams.get("passkey");
                const cookies      = request.headers.cookie ? parseCookies(request.headers.cookie ?? ""): {};
                const cookieToken  = cookies.access_token;

                const rawToken = passkeyParam ?? cookieToken;

                if (!rawToken) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }

                let decoded;
                try {
                    decoded = verifyToken(rawToken);
                } catch {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }

                // passkey tokens are typed "passkey"; cookie tokens are typed "access"
                const expectedType = passkeyParam ? "passkey" : "access";
                if (decoded.type !== expectedType) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const userId = String(decoded.sub);
                const sid    = decoded.sid;

                // Session must still be alive in Redis
                const activeSid = await redisClient.get(userSessionKey(userId));
                if (expectedType !== "passkey" && (!activeSid || activeSid !== sid)) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }

                // Rate-limit message attempts per user
                const connectAllowed = await socketRateLimit(userId, SOCKET_MESSAGE_LIMIT, SOCKET_WINDOW_TIME);
                if (!connectAllowed) {
                    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const matchState = await redisClient.hgetall(`match:${matchId}`);

                if(!matchState || !Object.keys(matchState).length){
                    socket.write("HTTP/1.1 404 - Match Not Found\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const team1Id = matchState.team1?.split(":")[0];
                const team2Id = matchState.team2?.split(":")[0]; 

                if(userId !== team1Id && userId !== team2Id && decoded.role !== USER_ROLE.ADMIN){
                    socket.write("HTTP/1.1 403 Forbidden. Please visit the public match page to view the discussion.\r\n\r\n");
                    socket.destroy();
                    return;
                }

                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    ws.user = {
                        id: userId,
                        sid,
                        username: decoded.username,
                        email: decoded.email,
                        role: decoded.role,
                        team: team1Id === userId ? "team1" : team2Id === userId ? "team2" : decoded.role=== USER_ROLE.ADMIN? 'admin':'viewer',
                        authType: expectedType,
                    }

                    ws.matchId = matchId;
                    if (!this.socketStore.has(matchId)) {
                        this.socketStore.set(matchId, new Set());
                    }
                    this.socketStore.get(matchId).add(ws);
                    this.wss.emit('connection', ws, request);
                })

            } catch (error) {
                console.error("Error during WebSocket upgrade:", error);
                socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
                socket.destroy();
                return;
            }
        })

        this.wss.on('connection', async (ws) => {
            logInfo(`WebSocket client connected successfully. Match ID: ${ws.matchId}, User Name: ${ws.user?.username}, Role: ${ws.user?.role}.`);

            const joinedMatchSockets = this.getSocketsForMatch(ws.matchId);
            if (joinedMatchSockets && joinedMatchSockets.size) {
                joinedMatchSockets.forEach((socket) => {
                    if (socket.readyState === WebSocket.OPEN && socket !== ws) {
                        sendSocketMessage(socket, buildSocketEnvelope({
                            type: SOCKET_MESSAGE_TYPE.USER_JOINED,
                            data: {
                                message: `${ws.user?.team || 'User'} joined the match.`,
                            },
                            from: SOCKET_SENDER.SYSTEM,
                        }));
                    }
                });
            }
            
            if (ws.readyState === WebSocket.OPEN) {
                let welcomeMsg = `Welcome ${ws.user.username} to AgentSlam! You are connected as ${ws.user.team}.`
                if(ws.user.team !== 'viewer'){
                    welcomeMsg+=`Get ready to slam! Send debate messages using: { "type": "debate-message", "data": { "message": "your argument" } }.`;
                }
                sendSocketMessage(ws, buildSocketEnvelope({
                    type: SOCKET_MESSAGE_TYPE.WELCOME,
                    data: {
                        message: welcomeMsg
                    },
                    from: SOCKET_SENDER.SYSTEM,
                }));
                
                const matchState = await redisClient.hgetall(`match:${ws.matchId}`);
                const formattedMatchState = formatMatchState(matchState);
                sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.MATCH_STATE, data: formattedMatchState, from: SOCKET_SENDER.SYSTEM }));

                if(matchState.status === MATCH_STATUS.STARTED){
                    const prevConverations = await matchModel.findById(ws.matchId).lean().select("conversations").exec();

                    if(prevConverations && prevConverations.conversations && prevConverations.conversations.length){
                        sendSocketMessage(ws, buildSocketEnvelope({
                            type: SOCKET_MESSAGE_TYPE.PREVIOUS_MESSAGE,
                            data: { message: `Match is already live! Here are the previous conversations.`, conversations: prevConverations.conversations },
                            from: SOCKET_SENDER.SYSTEM,
                        }));
                    }else{
                        sendSocketMessage(ws, buildSocketEnvelope({
                            type: SOCKET_MESSAGE_TYPE.PREVIOUS_MESSAGE,
                            data: { message: `Match is already live! No conversations yet.`, conversations: [] },
                            from: SOCKET_SENDER.SYSTEM,
                        }));
                    }
                }
            }

            ws.on('message', async (message) => {

                const allowed = await socketRateLimit(ws.user.id, SOCKET_MESSAGE_LIMIT, SOCKET_WINDOW_TIME);

                if (!allowed) {
                    sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Too many messages!` }, from: SOCKET_SENDER.SYSTEM }));
                    return;
                }

                const socketList = this.socketStore.get(ws.matchId);
                const matchState = await redisClient.hgetall(`match:${ws.matchId}`);

                if (!matchState || !Object.keys(matchState).length) {
                    return;
                }

                const currTurn = matchState.turn; 

                try {
                    message = JSON.parse(message.toString());
                    if(!message.type || !message.data || typeof message.data.message !== "string" || !Object.values(SOCKET_MESSAGE_TYPE).includes(message.type)){
                        throw new Error("Invalid message format");
                    }
                } catch {
                    if (ws.readyState === WebSocket.OPEN) {
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Invalid message format.` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                if(matchState.status !== MATCH_STATUS.STARTED){
                    if(ws.readyState === WebSocket.OPEN){
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Match is not currently accepting message.` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                if(ws.user.team === 'viewer'){
                    if(ws.readyState === WebSocket.OPEN){
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `You can't send message.` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                if(ws.user.team !== currTurn && ws.user.role !== USER_ROLE.ADMIN){
                    if(ws.readyState === WebSocket.OPEN){
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `It's not your turn! Please wait for your turn.` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                const textMessage = message?.data?.message;

                if(textMessage && textMessage.length > MAX_CHAT_MESSAGE_SIZE){
                    if(ws.readyState === WebSocket.OPEN){
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Message exceeds maximum allowed size of ${MAX_CHAT_MESSAGE_SIZE} bytes. Please shorten your message.` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                if(ws.user.role !== USER_ROLE.ADMIN && message.type === SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE){

                    const match = await matchModel.findById(ws.matchId);

                    if(match && match.matchStatus === MATCH_STATUS.STARTED){
                        match.conversations.push({
                            team: ws.user.team,
                            user: ws.user.id,
                            message: textMessage,
                            timestamp: new Date(),
                        })

                        await match.save();
                        await redisClient.hset(`match:${ws.matchId}`, {
                            'turn': currTurn === "team1" ? "team2" : "team1", // Switch turn after each message
                        })
                    }else{
                        if(ws.readyState === WebSocket.OPEN){
                            sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Cannot send debate messages when match is not live.` }, from: SOCKET_SENDER.SYSTEM }));
                        }
                    }
                }

                if(socketList && socketList.size){
                    socketList.forEach(socket => {
                        if(socket != ws && socket.readyState === WebSocket.OPEN){
                            sendSocketMessage(socket, buildSocketEnvelope({
                                type: SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE,
                                data: { message: textMessage },
                                from: resolveSocketSender(ws.user.team),
                            }));
                        }else if(socket === ws && socket.readyState === WebSocket.OPEN){
                            sendSocketMessage(socket, buildSocketEnvelope({
                                type: SOCKET_MESSAGE_TYPE.INFO,
                                data: { message: 'acknowledged' },
                                from: SOCKET_SENDER.SYSTEM,
                            }));
                        }
                    })

                    if (message.type === SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE) {
                        const latestState = await redisClient.hgetall(`match:${ws.matchId}`);
                        if (latestState && Object.keys(latestState).length) {
                            this.broadcastToMatch(ws.matchId, SOCKET_MESSAGE_TYPE.MATCH_STATE, formatMatchState(latestState));
                        }
                    }
                }
            })
            
            ws.on('close',(code, reason)=>{
                const matchId = ws.matchId;
                const sockets = this.socketStore.get(matchId);
                const username = ws.user.username
                if(sockets && sockets.size){
                    sockets.delete(ws);
                }

                reason = reason.toString() || "No reason provided";
                logInfo(`WebSocket client disconnected. Match ID: ${matchId}, Team: ${ws.user.team}, User: ${username}, Code: ${code}, Reason: ${reason}.`);

                const remainingMatchSockets = this.getSocketsForMatch(matchId);
                if(remainingMatchSockets && remainingMatchSockets.size){
                    remainingMatchSockets.forEach(socket => {
                        if(socket.readyState === WebSocket.OPEN && socket != ws){
                            sendSocketMessage(socket, buildSocketEnvelope({
                                type: SOCKET_MESSAGE_TYPE.USER_LEFT,
                                data: {
                                    message: `${ws.user.team} has left the match.`,
                                },
                                from: SOCKET_SENDER.SYSTEM,
                            }));
                        }
                    })
                }
            })

        })

        this.wss.on("wsClientError", (err, socket) => {
            console.error("Bad WebSocket client error:", err);
            socket.destroy();
        });

        this.wss.on('close',()=>{

            logInfo('WebSocket server closed.');
        })

        // ── Sandbox connection handler ────────────────────────────────────────
        this.sandboxWss.on('connection', (ws) => {

            if (ws.readyState === WebSocket.OPEN) {
                sendSocketMessage(ws, buildSocketEnvelope({
                    type: SOCKET_MESSAGE_TYPE.WELCOME,
                    data: {
                        message: `Welcome to the AgentSlam Sandbox. Send messages using: { 'type': 'sandbox-message', 'data': { 'message': 'your message' } }. This session will auto-disconnect in 10 minutes.`
                    },
                    from: SOCKET_SENDER.SYSTEM,
                }));
            }

            // Auto-disconnect after SANDBOX_DURATION
            const autoDisconnect = setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.INFO, data: { message: 'Sandbox session expired. You have been disconnected after 10 minutes.' }, from: SOCKET_SENDER.SYSTEM }));
                    ws.close(1000, 'Session timeout');
                }
            }, SANDBOX_DURATION);

            ws.on('message', async (rawMsg) => {

                const allowed = await sandboxSocketRateLimit(`sandbox:${ws.user.id}`, SANDBOX_MSG_LIMIT, SANDBOX_MSG_WINDOW);
                if (!allowed) {
                    if (ws.readyState === WebSocket.OPEN) {
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Rate limit exceeded.`}, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                let parsed;
                try {
                    parsed = JSON.parse(rawMsg.toString());
                    if(!parsed.type || !parsed.data || typeof parsed.data.message !== "string" || !Object.values(SOCKET_MESSAGE_TYPE).includes(parsed.type)){
                        throw new Error("Invalid message format");
                    }
                } catch {
                    if (ws.readyState === WebSocket.OPEN) {
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Invalid format. Send JSON: { 'type': 'sandbox-message', 'data': { 'message': '...' } }` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                if (parsed.type !== SOCKET_MESSAGE_TYPE.SANDBOX_MESSAGE) {
                    if (ws.readyState === WebSocket.OPEN) {
                        sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.ERROR, data: { message: `Unknown message type "${parsed.type}". Use type: "sandbox-message".` }, from: SOCKET_SENDER.SYSTEM }));
                    }
                    return;
                }

                // Echo the message back
                if (ws.readyState === WebSocket.OPEN) {
                    sendSocketMessage(ws, buildSocketEnvelope({ type: SOCKET_MESSAGE_TYPE.SANDBOX_MESSAGE, data: parsed.data, from: SOCKET_SENDER.SYSTEM }));
                }
            });

            ws.on('close', () => {
                clearTimeout(autoDisconnect);
                logInfo(`Sandbox session closed for userId ${ws.user.id}.`);
            });
        });

        logInfo('WebSocket server initialized successfully.');
    }

    broadcastToMatch = (matchId, type, data) => {

        // console.log(`Broadcasting to match ${matchId} - Type: ${type}, Data:`, data);
        const socketList = this.socketStore.get(matchId);
        if(socketList && socketList.size){
            socketList.forEach(ws => {
                if(ws.readyState === WebSocket.OPEN){
                    // console.log(`Broadcasting message to match ${matchId}:`, {type, data});
                    sendSocketMessage(ws, buildSocketEnvelope({ type, data, from: SOCKET_SENDER.SYSTEM }));
                }
            })
        }
    }

    processForResult = async (matchId) => {

        await bullmqService.addResultJob(matchId);
    }

    setMatchTimeout = (matchId, interval) => {
        const timer = setTimeout(async ()=>{

            this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `Time's up!` });

            try {
                const matchState = await redisClient.hgetall(`match:${matchId}`);
    
                await redisClient.hset(`match:${matchId}`, {
                    'status': MATCH_STATUS.COMPLETED,
                    'turn': null,
                    'finishTime': 0,
                    'remainingTime': 0,
                })
    
                await matchModel.findByIdAndUpdate(matchId, {
                    $set: { matchStatus: MATCH_STATUS.COMPLETED, finishTime: 0, remainingTime: 0 }
                }, { new: true });
                logInfo(`Match state saved successfully. Match ID: ${matchId}, Status: ${MATCH_STATUS.COMPLETED}.`);

            } catch (error) {
                console.error("Error occurred while updating match status:", error);
            }

            this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_FINISH, { message: `The match has ended!` });

            //bullmq activities
            try {
                await this.processForResult(matchId);
                logInfo(`Result processing job queued successfully. Match ID: ${matchId}.`);
            } catch (error) {
                console.error(`Error adding result processing job for match ${matchId}:`, error);
            }

            this.unregisterMatch(matchId, 1000, 'Match completed');
            this.timerStore.delete(matchId);
        }, interval);

        return timer;
    }

    startMatch =  async (matchId, finishTime, turn, duration) => {

        const existingTimer = this.timerStore.get(matchId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.timerStore.delete(matchId);
        }

        const stateFromRedis = await redisClient.hgetall(`match:${matchId}`);
        const matchState = formatMatchState(stateFromRedis);
        logInfo(`Match started successfully. Match ID: ${matchId}, Turn: ${turn}, Finish time: ${new Date(finishTime).toISOString()}.`);
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_STARTED, { message: `The match has started! Let the slam begin! It's ${turn}'s turn.`, finishTime });
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_STATE, matchState);
        const timer = this.setMatchTimeout(matchId, duration);

        this.timerStore.set(matchId, timer);
    }

    pauseMatch = (matchId, timeRemaining) => {
        logInfo(`Match paused successfully. Match ID: ${matchId}, Remaining time (ms): ${timeRemaining}.`);
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_PAUSED, { timeRemaining, message: "Match has been paused." });
        const timer = this.timerStore.get(matchId);
        if(timer){
            clearTimeout(timer);
            this.timerStore.delete(matchId);
        }

        redisClient.hgetall(`match:${matchId}`)
            .then((state) => {
                if (state && Object.keys(state).length) {
                    this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_STATE, formatMatchState(state));
                }
            })
            .catch((error) => {
                console.error(`Failed to broadcast paused match state for ${matchId}:`, error);
            });

    }

    resumeMatch = (matchId, finishTime, turn, remainingTime) => {
        logInfo(`Match resumed successfully. Match ID: ${matchId}, Turn: ${turn}, Finish time: ${new Date(finishTime).toISOString()}.`);
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_RESUMED, { finishTime, message: `Match has resumed! It's ${turn}'s turn.` });

        const existingTimer = this.timerStore.get(matchId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.timerStore.delete(matchId);
        }

        redisClient.hgetall(`match:${matchId}`)
            .then((state) => {
                if (state && Object.keys(state).length) {
                    this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_STATE, formatMatchState(state));
                }
            })
            .catch((error) => {
                console.error(`Failed to broadcast resumed match state for ${matchId}:`, error);
            });
        
        const timer = this.setMatchTimeout(matchId, Number(remainingTime));

        this.timerStore.set(matchId, timer);
    }

    registerMatch = (matchId) =>{

        if(!this.socketStore.has(matchId)){
            this.socketStore.set(matchId, new Set());
            logInfo(`Match registered in socket store successfully. Match ID: ${matchId}.`);
        }
    }

    unregisterMatch = (matchId, code = 1000, reason = 'Match session closed') => {
        
        if(this.timerStore.has(matchId)){
            clearTimeout(this.timerStore.get(matchId));
            this.timerStore.delete(matchId);
        }
        const sockets = this.socketStore.get(matchId);
        if(sockets && sockets.size){
            sockets.forEach(socket => {
                try {
                    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                        socket.close(code, reason);
                        setTimeout(() => {
                            if (socket.readyState !== WebSocket.CLOSED) {
                                socket.terminate();
                            }
                        }, 200);     
                    }
                } catch (error) {
                    console.error(`Error closing socket for match ${matchId}:`, error);
                }
            })
        }
        this.socketStore.delete(matchId);
        logInfo(`Match unregistered from socket store successfully. Match ID: ${matchId}.`);
        return;
    }

    getSocketsForMatch = (matchId) => {
        return this.socketStore.get(matchId) || null;
    }

    resetSocketStore = () => {
        Array.from(this.socketStore.keys()).forEach((matchId) => this.unregisterMatch(matchId, 1001, 'Server reset'));
        this.socketStore.clear();
        return true;
    }
}

export default new SocketService();