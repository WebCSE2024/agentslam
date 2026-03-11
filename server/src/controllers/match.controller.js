import matchModel from "../models/match.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import redisClient from "../configs/redis.config.js";
import roundModel from "../models/round.model.js";
import topicModel from "../models/topic.model.js";
import socketService from "../services/socket.service.js";
import { MATCH_STATUS, TOPIC_TYPE, ROUND_STATUS, SOCKET_MESSAGE_TYPE } from "../utils/enum.js";

export const MATCH_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
class MatchController{

    generateMatches = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {currRoundId} = req.body;

        if(!currRoundId){
            throw new ApiError(400, "Current round ID is required to generate matches");
        }

        const currRound = await roundModel.findById(currRoundId);

        if(!currRound){
            throw new ApiError(404, "Current round not found");
        }

        if(currRound.roundStatus !== ROUND_STATUS.CREATED){
            throw new ApiError(400, "Matches can only be generated for rounds in created status");
        }

        const leaderBoard = await redisClient.zrange("leaderboard", 0, -1);

        if(!leaderBoard || !leaderBoard.length){
            throw new ApiError(400, "Leaderboard error");
        }

        const topics = await topicModel.find({round: currRoundId}).lean().sort({ weights: -1 });
        if(!topics || !topics.length){
            throw new ApiError(400, "No topics found for the current round");
        }

        let matchesCreated = 0;
        let matchCreationErrors = 0;

        const len = leaderBoard.length;
        if(len%2 !== 0){
            leaderBoard.pop()
        }
        for(let j=0; j<len/2; j+=1){

            const team1 = leaderBoard[j].split(':')[0] // userId:username
            const team2 = leaderBoard[len-1-j].split(':')[0] // userId:username
            const topic = topics[0]._id; // Get the highest weight topic
            topics[0].weights = topics[0].weights - 1; // Decrease the weight for the next user
            topics.sort((a, b) => b.weights - a.weights); // Sort topics based on updated weights

            const proTeam = Math.random() < 0.5 ? team1 : team2; // Randomly assign pro and con teams

            try {
                const match = await matchModel.create({
                    opponents:{
                        team1:{
                            user: team1,
                            topicType: proTeam === team1 ? TOPIC_TYPE.PROS : TOPIC_TYPE.CONS,
                        },
                        team2:{
                            user: team2,
                            topicType: proTeam === team2 ? TOPIC_TYPE.PROS : TOPIC_TYPE.CONS,
                        },
                        topic,
                        round: currRoundId,
                        matchStatus: MATCH_STATUS.PENDING,
                    }
                })

                if(match){
                    matchesCreated++;
                } else {
                    matchCreationErrors++;
                }
            } catch (error) {
                matchCreationErrors++;
            }
        }

        currRound.roundStatus = ROUND_STATUS.READY;
        await currRound.save();

        return new ApiResponse(200, {
            matchesCreated,
            matchCreationErrors,
            currRound
        }, "Matches generated and round status updated successfully")

    })

    activateMatch = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to start the match");
        }
        
        const match = await matchModel.findById(matchId)
                    .populate("opponents.team1.user", "username")
                    .populate("opponents.team2.user", "username")
                    .populate("topic", "title description")
                    .populate("round", "name roundStatus");

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        match.matchStatus = MATCH_STATUS.ACTIVE;
        await match.save();

        await redisClient.hset(`match:${matchId}`, {
            'team1': `${match.opponents.team1.user.username}:${match.opponents.team1.user._id.toString()}`,
            'team2': `${match.opponents.team2.user.username}:${match.opponents.team2.user._id.toString()}`,
            'finishTime': 0,
            'topic': String(match.topic.title),
            'description': String(match.topic.description),
            'round': String(match.round.name),
            'pros': match.opponents.team1.topicType === TOPIC_TYPE.PROS ? 'team1' : 'team2',
            'cons': match.opponents.team1.topicType === TOPIC_TYPE.CONS ? 'team1' : 'team2',
            'turn':null,
            'status': match.matchStatus,
        })

        socketService.registerMatch(matchId);

        return new ApiResponse(200, match, "Match activated successfully")
    })

    startMatch = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to start the match");
        }

        const match = await matchModel.findById(matchId);

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        match.matchStatus = MATCH_STATUS.STARTED;
        await match.save();
        const finishTime = Date.now() + MATCH_DURATION
        const matchState = await redisClient.hset(`match:${matchId}`, {
            'finishTime': finishTime,
            'timeRemaining': 0,
            'status': match.matchStatus,
            'turn': Math.random() < 0.5 ? 'team1' : 'team2', // Randomly select which team starts
         })
        
        socketService.startMatch(matchId, finishTime, matchState.turn, MATCH_DURATION);

        return new ApiResponse(200, match, "Match started successfully")
    })

    pauseMatch = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to pause the match");
        }

        const match = await matchModel.findById(matchId);
        
        if(!match){
            throw new ApiError(404, "Match not found");
        }

        if(match.matchStatus !== MATCH_STATUS.STARTED){
            throw new ApiError(400, "Only a started match can be paused");
        }

        // Snapshot remaining time before pausing
        const finishTime = await redisClient.hget(`match:${matchId}`, 'finishTime');
        const timeRemaining = Math.max(0, parseInt(finishTime) - Date.now());

        match.matchStatus = MATCH_STATUS.PAUSED;
        await match.save();

        await redisClient.hset(`match:${matchId}`, {
            'status': match.matchStatus,
            'timeRemaining': timeRemaining, // ms left when paused
            'finishTime': 0,               // invalidate — no longer ticking
        });

        socketService.pauseMatch(matchId, timeRemaining);

        return new ApiResponse(200, { timeRemaining }, "Match paused successfully");
    })

    resumeMatch = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to resume the match");
        }

        const match = await matchModel.findById(matchId);

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        if(match.matchStatus !== MATCH_STATUS.PAUSED){
            throw new ApiError(400, "Only a paused match can be resumed");
        }

        // Restore finish time from saved remaining time
        const storedRemaining = await redisClient.hget(`match:${matchId}`, 'timeRemaining');
        if(!storedRemaining || parseInt(storedRemaining) <= 0){
            throw new ApiError(400, "No valid remaining time found — cannot resume match");
        }

        const newFinishTime = Date.now() + parseInt(storedRemaining);

        match.matchStatus = MATCH_STATUS.STARTED;
        await match.save();

        const matchState = await redisClient.hset(`match:${matchId}`, {
            'status': match.matchStatus,
            'finishTime': newFinishTime, // new absolute end time
            'timeRemaining': 0,          // clear snapshot — match is live again
        });

        socketService.resumeMatch(matchId, newFinishTime, matchState.turn, storedRemaining);

        return new ApiResponse(200, { finishTime: newFinishTime }, "Match resumed successfully");
    })

    getMatchInfo = asyncHandler(async(req, res) => {
        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to get match info");
        }

        const match = await matchModel.findById(matchId).populate("opponents.team1.user", "username")
        .populate("opponents.team2.user", "username")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "username");

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        return new ApiResponse(200, match, "Match info retrieved successfully")
    })

    getMatchByRound = asyncHandler(async(req, res) => {

        const {roundId} = req.params;

        if(!roundId){
            throw new ApiError(400, "Round ID is required to get matches");
        }

        const matches = await matchModel.find({"opponents.round": roundId}).populate("opponents.team1.user", "username")
        .populate("opponents.team2.user", "username")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "username");

        if(!matches || !matches.length){
            throw new ApiError(404, "No matches found for the given round");
        }

        return new ApiResponse(200, matches, "Matches for the round retrieved successfully")
    })

    getAllMatches = asyncHandler(async(req, res) => {
        const matches = await matchModel.find({}).populate("opponents.team1.user", "username")
        .populate("opponents.team2.user", "username")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "username").sort({createdAt: 1});

        if(!matches || !matches.length){
            throw new ApiError(404, "No matches found");
        }

        return new ApiResponse(200, matches, "All matches retrieved successfully")
    })

    updateMatchResult = async(matchId, result) => {

        const match = await matchModel.findById(matchId);

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        match.scores = result.scores;
        match.winner = result.winner;
        match.matchStatus = MATCH_STATUS.COMPLETED;
        
        await match.save();

        await redisClient.del(`match:${matchId}`); // Clean up match state from Redis

        // Notify clients about match completion
        socketService.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `The match has ended!`, result: result, from: 'system' });

        return match;
    }

    updateManualMatchResult = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const {matchId} = req.params;
        const {scores, winner} = req.body;

        if(!matchId || !scores || !winner){
            throw new ApiError(400, "Match ID, scores and winner are required to update match result");
        }

        const match = await this.updateMatchResult(matchId, { scores, winner });

        return new ApiResponse(200, match, "Match result updated successfully")
    })

    resetMatchDB = async() => {
        try {
            await matchModel.deleteMany({});
            console.log("Match database reset successfully");
        } catch (error) {
            console.error("Error resetting match database:", error);
        }
        return;
    }
}

export default new MatchController();