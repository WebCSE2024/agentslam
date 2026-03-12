import { WebSocketServer } from 'ws';
import { MATCH_STATUS, SOCKET_MESSAGE_TYPE } from '../utils/enum.js';
import bullmqService from './bullmq.service.js';
import { sandboxSocketRateLimit, socketRateLimit } from '../middlewares/socketratelimit.middleware.js';
import redisClient from '../configs/redis.config.js';
import { verifyToken } from '../utils/authtoken.js';
import { userSessionKey } from '../utils/rediskeys.js';
import matchModel from '../models/match.model.js';
import { USER_STATUS } from '../utils/enum.js';
import userModel from '../models/user.model.js';

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
        finishTime: matchState.finishTime,
        pros: matchState.pros,
        cons: matchState.cons,
        turn: matchState.turn,
    }
}

const MAX_MESSAGE_SIZE = 1024 * 5; // 5KB
const MAX_CHAT_MESSAGE_SIZE = 1024 * 2; // 2KB
const SOCKET_MESSAGE_LIMIT = 5       // max messages per window per user
const SOCKET_WINDOW_TIME = 2*60   // 2-minute window for messages

const SANDBOX_MSG_LIMIT  = 8;        // max messages per sandbox window
const SANDBOX_MSG_WINDOW = 600;      // 10-minute window (seconds)
const SANDBOX_DURATION   = 600_000;  // auto-disconnect after 10 min (ms)


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

                    console.log('Sandbox token verified for user ID:', decoded.sub);
                    const userId = String(decoded.sub);

                    const allowed = await sandboxSocketRateLimit(userId, SOCKET_MESSAGE_LIMIT, SOCKET_WINDOW_TIME);

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
                const cookies      = parseCookies(request.headers.cookie ?? "");
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

                if(!matchState){
                    socket.write("HTTP/1.1 404 - Match Not Found\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const team1Id = matchState.team1?.split(":")[0];
                const team2Id = matchState.team2?.split(":")[0];

                if(team1Id !== userId && team2Id !== userId && decoded.role !== 'admin'){
                    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
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
                        team: team1Id === userId ? "team1" : team2Id === userId ? "team2" : "admin",
                        authType: expectedType,
                    }

                    ws.matchId = matchId;
                    this.registerMatch(matchId);
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
            
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: SOCKET_MESSAGE_TYPE.WELCOME,
                    from: 'system',
                    data: {
                        message: `Welcome ${ws.user.username} to AgentSlam! You are connected as ${ws.user.team}. Get ready to slam! Send debate messages using: { 'type': 'DEBATE_MESSAGE', 'data': { 'message': 'your argument' } }`
                    }
                }));
                
                const matchState = await redisClient.hgetall(`match:${ws.matchId}`);
                const formattedMatchState = formatMatchState(matchState);
                ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.MATCH_STATE, data: formattedMatchState, from: 'system'}))

                if(matchState.status === MATCH_STATUS.STARTED){
                    const prevConverations = await matchModel.findById(ws.matchId).lean().select("conversations").exec();

                    if(prevConverations && prevConverations.conversations && prevConverations.conversations.length){
                        ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.MATCH_UPDATE, data: { message: `Match is already live! Here are the previous conversations.`, conversations: prevConverations.conversations, from: 'system' }}))
                    }else{
                        ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.MATCH_UPDATE, data: { message: `Match is already live! No conversations yet.`, from: 'system' }}))
                    }
                }
            }

            ws.on('message', async (message) => {

                const allowed = await socketRateLimit(ws.user.id, SOCKET_MESSAGE_LIMIT, SOCKET_WINDOW_TIME);

                if (!allowed) {
                    ws.send(JSON.stringify({
                        type: SOCKET_MESSAGE_TYPE.ERROR,
                        data: { message: `Too many messages!`, from: 'system'}
                    }));
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
                } catch {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            data: { message: `Invalid message format.`, from: 'system'}
                        }));
                    }
                    return;
                }

                if(matchState.status !== MATCH_STATUS.STARTED){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            data: {message: `Match is not currently accepting message.`, from: 'system'}
                        }))
                    }
                    return;
                }

                if(ws.user.team !== currTurn && ws.user.role !== "admin"){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            data: {message: `It's not your turn! Please wait for your turn.`, from: 'system'}
                        }))
                    }
                    return;
                }

                const textMessage = message?.data?.message;

                if(textMessage && textMessage.length > MAX_CHAT_MESSAGE_SIZE){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            data: {message: `Message exceeds maximum allowed size of ${MAX_CHAT_MESSAGE_SIZE} bytes. Please shorten your message.`, from: 'system'}
                        }))
                    }
                    return;
                }

                if(ws.user.role !== "admin" && message.type === SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE){

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
                        if(ws.readyState === ws.OPEN){
                            ws.send(JSON.stringify({
                                type: SOCKET_MESSAGE_TYPE.ERROR,
                                data: {message: `Cannot send debate messages when match is not live.`, from: 'system'}
                            }))
                        }
                    }
                }

                if(socketList && socketList.size){
                    socketList.forEach(socket => {
                        if(socket != ws && socket.readyState === socket.OPEN){
                            socket.send(JSON.stringify({
                                type: SOCKET_MESSAGE_TYPE.INFO,
                                data: {message: textMessage, from: ws.user.team}
                            }));
                        }else if(socket === ws && socket.readyState === socket.OPEN){
                            socket.send(JSON.stringify({
                                type: SOCKET_MESSAGE_TYPE.INFO,
                                data: {message: 'acknowledged', from: 'system'}
                            }))
                        }
                    })
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
                console.log(`WebSocket connection closed for user ${username} in match ${matchId}. Code: ${code}, Reason: ${reason}`)
                if(sockets && sockets.size){
                    sockets.forEach(socket => {
                        if(socket.readyState === socket.OPEN){
                            socket.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.INFO, data: {message: `${username} has left the match.`, from: "system"}}));
                        }
                    })
                }
            })

        })

        this.wss.on("wsClientError", (err, socket) => {
            console.log("bad websocket client:", err.message);
            socket.destroy();
        });

        this.wss.on('close',()=>{

            console.log('Websocket server closes')
        })

        // ── Sandbox connection handler ────────────────────────────────────────
        this.sandboxWss.on('connection', (ws) => {

            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: SOCKET_MESSAGE_TYPE.WELCOME,
                    from: 'system',
                    data: {
                        message: `Welcome to the AgentSlam Sandbox, ${ws.user.username}. Send messages using: { 'type': 'SANDBOX_MESSAGE', 'data': { 'message': 'your message' } }. This session will auto-disconnect in 10 minutes.`
                    }
                }));
            }

            // Auto-disconnect after SANDBOX_DURATION
            const autoDisconnect = setTimeout(() => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: SOCKET_MESSAGE_TYPE.INFO,
                        from: 'system',
                        data: { message: 'Sandbox session expired. You have been disconnected after 10 minutes.' }
                    }));
                    ws.close(1000, 'Session timeout');
                }
            }, SANDBOX_DURATION);

            ws.on('message', async (rawMsg) => {

                const allowed = await sandboxSocketRateLimit(`sandbox:${ws.user.id}`, SANDBOX_MSG_LIMIT, SANDBOX_MSG_WINDOW);
                if (!allowed) {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            from: 'system',
                            data: { message: `Rate limit exceeded. Max ${SANDBOX_MSG_LIMIT} messages per ${SANDBOX_MSG_WINDOW / 60} minutes in sandbox.` }
                        }));
                    }
                    return;
                }

                let parsed;
                try {
                    parsed = JSON.parse(rawMsg.toString());
                } catch {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            from: 'system',
                            data: { message: `Invalid format. Send JSON: { 'type': 'SANDBOX_MESSAGE', 'data': { 'message': '...' } }` }
                        }));
                    }
                    return;
                }

                if (parsed.type !== SOCKET_MESSAGE_TYPE.SANDBOX_MESSAGE) {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: SOCKET_MESSAGE_TYPE.ERROR,
                            from: 'system',
                            data: { message: `Unknown message type "${parsed.type}". Use type: "SANDBOX_MESSAGE".` }
                        }));
                    }
                    return;
                }

                // Echo the message back
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: SOCKET_MESSAGE_TYPE.SANDBOX_MESSAGE,
                        from: 'echo',
                        data: parsed.data
                    }));
                }
            });

            ws.on('close', () => {
                clearTimeout(autoDisconnect);
                console.log(`Sandbox session closed for user ${ws.user.id}`);
            });
        });

        console.log("WebSocket server initialized");
    }

    broadcastToMatch = (matchId, type, data) => {

        console.log(`Request came for broadcasting message to match ${matchId}:`, {type, data});
        const socketList = this.socketStore.get(matchId);
        if(socketList && socketList.size){
            socketList.forEach(ws => {
                if(ws.readyState === ws.OPEN){
                    console.log(`Broadcasting message to match ${matchId}:`, {type, data});
                    ws.send(JSON.stringify({type, data, from: 'system'}));
                }
            })
        }
    }

    processForResult = async (matchId) => {

        await bullmqService.addResultJob(matchId);
    }

    setMatchInterval = (matchId, interval) => {
        const timer = setInterval(async ()=>{

            this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `Time's up!`, from: 'system' });

            try {
                const matchState = await redisClient.hgetall(`match:${matchId}`);
    
                await redisClient.hset(`match:${matchId}`, {
                    'status': MATCH_STATUS.COMPLETED,
                    'turn': null,
                })
    
                const match = await matchModel.findByIdAndUpdate(matchId, { $set: { matchStatus: MATCH_STATUS.COMPLETED } }, { new: true });
                console.log(`Match State Updated for ${matchId}`)

            } catch (error) {
                console.error("Error occurred while updating match status:", error);
            }

            this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `The match has ended!`, from: 'system' });

            //bullmq activities
            try {
                await this.processForResult(matchId);
                console.log(`Result processing job added for match ${matchId}`);
            } catch (error) {
                console.error(`Error adding result processing job for match ${matchId}:`, error);
            }

            clearInterval(timer);
            this.timerStore.delete(matchId);
        }, interval);

        return timer;
    }

    startMatch =  (matchId, finishTime, turn, duration) => {

        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `The match has started! Let the slam begin! It's ${turn}'s turn.`, finishTime });
        
        const timer = this.setMatchInterval(matchId, duration);

        this.timerStore.set(matchId, timer);
    }

    pauseMatch = (matchId, timeRemaining) => {
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_PAUSED, { timeRemaining, message: "Match has been paused." });
        const timer = this.timerStore.get(matchId);
        if(timer){
            clearInterval(timer);
            this.timerStore.delete(matchId);
        }

    }

    resumeMatch = (matchId, finishTime, turn, remainingTime) => {
        this.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_RESUMED, { finishTime, message: `Match has resumed! It's ${turn}'s turn.` });
        
        const timer = this.setMatchInterval(matchId, remainingTime);

        this.timerStore.set(matchId, timer);
    }

    registerMatch = (matchId) =>{

        if(!this.socketStore.has(matchId)){
            this.socketStore.set(matchId, new Set());
        }
    }

    unregisterMatch = (matchId) => {
        
        const sockets = this.socketStore.get(matchId);
        if(sockets && sockets.size){
            sockets.forEach(socket => {
                socket.end();
            })
            this.socketStore.delete(matchId);
        }
        return;
    }

    getSocketsForMatch = (matchId) => {
        return this.socketStore.get(matchId) || null;
    }

    resetSocketStore = () => {
        this.socketStore.forEach((sockets) => {
            sockets.forEach(socket => {
                socket.end();
            })
        })
        this.socketStore.clear();
    }
}

export default new SocketService();