import { WebSocketServer } from 'ws';
import { MATCH_STATUS, SOCKET_MESSAGE_TYPE } from '../utils/enum.js';
import bullmqService from './bullmq.service.js';
import { socketRateLimit } from '../middlewares/socketratelimit.middleware.js';
import redisClient from '../configs/redis.config.js';
import { verifyToken } from '../utils/authtoken.js';
import { userSessionKey } from '../utils/rediskeys.js';
import matchModel from '../models/match.model.js';

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
        team1: matchState.team1.split(":")[0],
        team2: matchState.team2.split(":")[0],
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
const SOCKET_MESSAGE_LIMIT = 5
const SOCKET_RATELIMIT_TIME = 2*60

class SocketService {

    constructor() {
        this.wss = null;
        this.socketStore = new Map();
        this.timerStore = new Map();
    }

    init(server) {
        this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_SIZE });

        server.on('upgrade', async (request, socket, head) => {

            try {
                const reqUrl = new URL(request.url, `http://${request.headers.host}`);

                // Only handle /ws — reject everything else immediately
                if (reqUrl.pathname !== "/ws") {
                    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const matchId = reqUrl.searchParams.get("matchId");
                const cookies = parseCookies(request.headers.cookie ?? "");
                const token = cookies.access_token;

                if(!token){
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }
                const decoded = verifyToken(token);
                if (decoded.type !== "access") {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }  
                const userId = String(decoded.sub);
                const sid = decoded.sid;
                const activeSid = await redisClient.get(userSessionKey(userId));
                if (!activeSid || activeSid !== sid) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                } 

                const matchState = await redisClient.hgetall(`match:${matchId}`);

                if(!matchState){
                    socket.write("HTTP/1.1 404 - Match Not Found\r\n\r\n");
                    socket.destroy();
                    return;
                }

                const team1Id = matchState.team1?.split(":")[1];
                const team2Id = matchState.team2?.split(":")[1];

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
                    }

                    ws.matchId = matchId;
                    this.registerMatch(matchId);
                    this.socketStore.get(matchId).add(ws);
                    this.wss.emit('connection', ws, request);
                })

            } catch (error) {
                socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
                socket.destroy();
                return;
            }
        })

        this.wss.on('connection', async (ws) => {
            
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.WELCOME, data:{message: `
                    Welcome ${ws.user.username} to AgentSlam! You are connected as ${ws.user.team}. Get ready to slam!
                `, from:'system'}}))
                
                const matchState = await redisClient.hgetall(`match:${ws.matchId}`);
                const formattedMatchState = formatMatchState(matchState);
                ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.MATCH_STATE, data: formattedMatchState}))
            }

            ws.on('message', async (message) => {

                const allowed = await socketRateLimit(ws.user.id, SOCKET_MESSAGE_LIMIT, SOCKET_RATELIMIT_TIME);

                if (!allowed) {
                ws.send(JSON.stringify({
                    type: SOCKET_MESSAGE_TYPE.ERROR,
                    data: { message: `Too many messages!`, from: 'system'}
                }));
                return;
                }
                const socketList = this.socketStore.get(ws.matchId);
                const matchState = await redisClient.hgetall(`match:${ws.matchId}`);
                const currTurn = matchState.turn; 

                message = JSON.parse(message.toString());

                if(matchState.status !== MATCH_STATUS.STARTED){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.ERROR, data: {message: `Match is not currently accepting message.`, from: 'system'}}))
                    }
                    return;
                }

                if(ws.user.team !== currTurn && ws.user.role !== "admin"){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.ERROR, data: {message: `It's not your turn! Please wait for your turn.`, from: 'system'}}))
                    }
                    return;
                }

                if(message.length > MAX_CHAT_MESSAGE_SIZE){
                    if(ws.readyState === ws.OPEN){
                        ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.ERROR, data: {message: `Message exceeds maximum allowed size of ${MAX_CHAT_MESSAGE_SIZE} bytes. Please shorten your message.`, from: 'system'}}))
                    }
                    return;
                }

                if(ws.user.role !== "admin" && message.type === SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE){

                    const match = await matchModel.findById(ws.matchId);
                    if(match.matchStatus === MATCH_STATUS.STARTED){
                        match.conversations.push({
                            team: ws.user.team,
                            user: ws.user.id,
                            message: message.data.message,
                            timestamp: new Date(),
                        })

                        await match.save();
                    }else{
                        if(ws.readyState === ws.OPEN){
                            ws.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.ERROR, data: {message: `Cannot send debate messages when match is not live.`, from: 'system'}}))
                        }
                    }
                }

                if(socketList && socketList.size){
                    socketList.forEach(socket => {
                        if(socket != ws && socket.readyState === socket.OPEN){
                            socket.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.INFO, data: {message: message.toString(), from: ws.user.team}}));
                        }else if(socket === ws && socket.readyState === socket.OPEN){
                            socket.send(JSON.stringify({type: SOCKET_MESSAGE_TYPE.INFO, data: {message: 'acknowledged', from: 'system'}}))
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

        console.log("WebSocket server initialized");
    }

    broadcastToMatch = (matchId, type, data) => {

        const socketList = this.socketStore.get(matchId);
        if(socketList && socketList.size){
            socketList.forEach(ws => {
                if(ws.readyState === ws.OPEN){
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
    
                const match = await matchModel.findByIdAndUpdate(matchId, { matchStatus: MATCH_STATUS.COMPLETED }, { new: true });
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