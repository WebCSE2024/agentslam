import matchModel from "../models/match.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import redisClient from "../configs/redis.config.js";
import roundModel from "../models/round.model.js";
import topicModel from "../models/topic.model.js";
import socketService from "../services/socket.service.js";
import mongoose from "mongoose";
import userModel from "../models/user.model.js";
import { userSessionKey } from "../utils/rediskeys.js";
import { sendEmail } from "../services/email.service.js";
import { matchResultEmailTemplate } from "../templates/matchResultEmail.js";
import { matchUpdateEmailTemplate } from "../templates/matchUpdateEmail.js";
import { signPasskeyToken } from "../utils/authtoken.js";
import { MATCH_STATUS, TOPIC_TYPE, ROUND_STATUS, SOCKET_MESSAGE_TYPE, USER_STATUS } from "../utils/enum.js";

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

        // Ensure even number of participants
        const len = leaderBoard.length % 2 !== 0 ? leaderBoard.length - 1 : leaderBoard.length;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let matchesCreated = 0;

            for(let j = 0; j < len / 2; j++){
                const team1 = leaderBoard[j].split(':')[0];           // userId
                const team2 = leaderBoard[len - 1 - j].split(':')[0]; // userId
                const topic = topics[0]._id;
                topics[0].weights -= 1;
                topics.sort((a, b) => b.weights - a.weights);

                const proTeam = Math.random() < 0.5 ? team1 : team2;

                await matchModel.create([{
                    opponents: {
                        team1: {
                            user: team1,
                            topicType: proTeam === team1 ? TOPIC_TYPE.PROS : TOPIC_TYPE.CONS,
                        },
                        team2: {
                            user: team2,
                            topicType: proTeam === team2 ? TOPIC_TYPE.PROS : TOPIC_TYPE.CONS,
                        },
                    },
                    topic,
                    round: currRoundId,
                    matchStatus: MATCH_STATUS.PENDING,
                }], { session });

                matchesCreated++;
            }

            currRound.roundStatus = ROUND_STATUS.READY;
            await currRound.save({ session });

            await session.commitTransaction();

            return new ApiResponse(200, {
                matchesCreated,
                currRound
            }, "Matches generated and round status updated successfully");

        } catch (error) {
            await session.abortTransaction();
            console.error("Match generation failed — transaction rolled back:", error);
            throw new ApiError(500, "Failed to generate matches. All changes have been rolled back.");
        } finally {
            session.endSession();
        }

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
                    .populate("opponents.team1.user", "_id name email")
                    .populate("opponents.team2.user", "_id name email")
                    .populate("topic", "title description")
                    .populate("round", "roundName roundStatus");

        if(!match){
            throw new ApiError(404, "Match not found");
        }

        match.matchStatus = MATCH_STATUS.ACTIVE;
        await match.save();

        await redisClient.hset(`match:${matchId}`, {
            'team1': `${match.opponents.team1.user._id.toString()}:${match.opponents.team1.user.name}`,
            'team2': `${match.opponents.team2.user._id.toString()}:${match.opponents.team2.user.name}`,
            'finishTime': 0,
            'topic': String(match.topic.title),
            'description': String(match.topic.description),
            'round': String(match.round.roundName),
            'pros': match.opponents.team1.topicType === TOPIC_TYPE.PROS ? 'team1' : 'team2',
            'cons': match.opponents.team1.topicType === TOPIC_TYPE.CONS ? 'team1' : 'team2',
            'turn':null,
            'status': match.matchStatus,
        })

        socketService.registerMatch(matchId);

        // Generate short-lived passkey tokens for each team member and email the WS link
        const WS_BASE = process.env.WS_URL || "ws://localhost:8000/ws";
        const team1User = match.opponents.team1.user;
        const team2User = match.opponents.team2.user;
        const team1Name = team1User.name || team1User.email;
        const team2Name = team2User.name || team2User.email;

        const buildPasskey = async (user) => {
            const activeSid = await redisClient.get(userSessionKey(user._id.toString()));
            return signPasskeyToken({
                userId:   user._id.toString(),
                sid:      activeSid ?? "",   // will be validated against Redis on WS connect
                role:     'user',
                username: user.username ?? user.name,
                email:    user.email,
            });
        };

        const passkey1 = await buildPasskey(team1User);
        const passkey2 = await buildPasskey(team2User);

        const wsUrl1 = `${WS_BASE}?matchId=${matchId}&passkey=${passkey1}`;
        const wsUrl2 = `${WS_BASE}?matchId=${matchId}&passkey=${passkey2}`;

        console.log(`Match ${matchId} activated. WS links generated: \n team1 (${team1Name}): ${wsUrl1} \n team2 (${team2Name}): ${wsUrl2}`);
        const tpl1 = matchUpdateEmailTemplate({ recipientName: team1Name, team1Name, team2Name, wsUrl: wsUrl1 });
        const tpl2 = matchUpdateEmailTemplate({ recipientName: team2Name, team1Name, team2Name, wsUrl: wsUrl2 });

        await sendEmail({ to: team1User.email, subject: tpl1.subject, html: tpl1.html, text: tpl1.text })
            .catch(err => console.error(`Failed to send match update email to team1 (${team1User.email}):`, err.message));
        await sendEmail({ to: team2User.email, subject: tpl2.subject, html: tpl2.html, text: tpl2.text })
            .catch(err => console.error(`Failed to send match update email to team2 (${team2User.email}):`, err.message));

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
        const turn = Math.random() < 0.5 ? 'team1' : 'team2';
        await match.save();
        const finishTime = Date.now() + MATCH_DURATION
        const matchState = await redisClient.hset(`match:${matchId}`, {
            'finishTime': finishTime,
            'status': match.matchStatus,
            'turn': turn, // Randomly select which team starts
         })
        
        socketService.startMatch(matchId, finishTime, turn, MATCH_DURATION);

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

        await redisClient.hdel(`match:${matchId}`, 'timeRemaining'); // cleanup
        socketService.resumeMatch(matchId, newFinishTime, matchState.turn, storedRemaining);

        return new ApiResponse(200, { finishTime: newFinishTime }, "Match resumed successfully");
    })

    getMatchInfo = asyncHandler(async(req, res) => {
        const {matchId} = req.params;

        if(!matchId){
            throw new ApiError(400, "Match ID is required to get match info");
        }

        const match = await matchModel.findById(matchId).populate("opponents.team1.user", "_id name email")
        .populate("opponents.team2.user", "_id name email")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "_id name email");

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

        const matches = await matchModel.find({round: roundId}).populate("opponents.team1.user", "_id name email")
        .populate("opponents.team2.user", "_id name email")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "_id name email");
        if(!matches || !matches.length){
            throw new ApiError(404, "No matches found for the given round");
        }

        return new ApiResponse(200, matches, "Matches for the round retrieved successfully")
    })

    getAllMatches = asyncHandler(async(req, res) => {
        const matches = await matchModel.find({}).populate("opponents.team1.user", "_id name email")
        .populate("opponents.team2.user", "_id name email")
        .populate("topic", "title description")
        .populate("round", "name roundStatus")
        .populate("winner", "_id name email").sort({createdAt: 1});
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

        // Populate once — used by all downstream steps
        const populated = await match.populate([
            { path: 'opponents.team1.user', select: '_id name username email' },
            { path: 'opponents.team2.user', select: '_id name username email' },
            { path: 'winner',              select: '_id name username' },
        ]);

        // Clear Redis match state
        await redisClient.del(`match:${matchId}`);

        // Notify socket clients
        socketService.broadcastToMatch(matchId, SOCKET_MESSAGE_TYPE.MATCH_UPDATE, { message: `The match has ended!`, result, from: 'system' });

        // Derive winner / loser from populated data
        const team1User  = populated.opponents.team1.user;
        const team2User  = populated.opponents.team2.user;
        const winnerId   = populated.winner._id.toString();
        const isTeam1Winner = team1User._id.toString() === winnerId;

        const winnerData = {
            id:    isTeam1Winner ? team1User._id.toString()  : team2User._id.toString(),
            name:  isTeam1Winner ? (team1User.name || team1User.username) : (team2User.name || team2User.username),
            email: isTeam1Winner ? team1User.email  : team2User.email,
            score: isTeam1Winner ? populated.scores?.team1 : populated.scores?.team2,
        };

        const loserData = {
            id:    isTeam1Winner ? team2User._id.toString()  : team1User._id.toString(),
            name:  isTeam1Winner ? (team2User.name || team2User.username) : (team1User.name || team1User.username),
            email: isTeam1Winner ? team2User.email  : team1User.email,
            score: isTeam1Winner ? populated.scores?.team2 : populated.scores?.team1,
        };

        // Disable loser + invalidate session + remove from leaderboard
        try {
            await userModel.updateOne({ _id: loserData.id }, { $set: { status: USER_STATUS.DISABLED }, $inc:{tournamentPoints: loserData.score} });
            await userModel.updateOne({_id: winnerData.id},{$inc:{tournamentPoints: winnerData.score}}); 
            await redisClient.del(userSessionKey(loserData.id));
            await redisClient.zrem('leaderboard', `${loserData.id}:${loserData.name}`);
            console.log(`Loser ${loserData.name} disabled and removed from leaderboard.`);
        } catch (err) {
            console.error(`Error disabling loser ${loserData.name}:`, err);
        }

        // Update winner's leaderboard score
        await redisClient.zincrby('leaderboard', winnerData.score, `${winnerData.id}:${winnerData.name}`);
        console.log(`Winner ${winnerData.name} score updated on leaderboard.`);

        // Send result emails to both participants
        const buildTpl = (recipientName) => matchResultEmailTemplate({
            recipientName,
            team1Name:  loserData.name,
            team2Name:  winnerData.name,
            scoreTeam1: loserData.score,
            scoreTeam2: winnerData.score,
            winnerName: winnerData.name,
        });

        const loserTpl  = buildTpl(loserData.name);
        const winnerTpl = buildTpl(winnerData.name);

        await sendEmail({ to: loserData.email,  subject: loserTpl.subject,  html: loserTpl.html,  text: loserTpl.text  })
            .catch(err => console.error(`Failed to send result email to loser (${loserData.email}):`, err.message));
        await sendEmail({ to: winnerData.email, subject: winnerTpl.subject, html: winnerTpl.html, text: winnerTpl.text })
            .catch(err => console.error(`Failed to send result email to winner (${winnerData.email}):`, err.message));

        console.log(`Result emails sent to ${loserData.email} and ${winnerData.email}.`);

        return populated;
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