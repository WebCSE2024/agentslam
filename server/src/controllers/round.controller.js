import roundModel from "../models/round.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { ROUND_STATUS, USER_ROLE, USER_STATUS, } from "../utils/enum.js";
import redisClient from "../configs/redis.config.js";
import userModel from "../models/user.model.js";
import { logInfo } from "../utils/logger.js";

class RoundController{

    loadLeaderBoard = async()=>{

        const teams = await userModel.find({role: USER_ROLE.USER, status: USER_STATUS.ACTIVE}).lean().select("_id name tournamentPoints");
        for(const team of teams){
            await redisClient.zadd("leaderboard", Number(team.tournamentPoints) || 0, `${team._id}:${team.name}`)
        }
        logInfo(`Leaderboard loaded in Redis successfully. Entries: ${teams.length}.`);

        return;
    }

    refreshLeaderBoard = asyncHandler(async(req,res)=>{

        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }

        const ongoingRound = await roundModel.countDocuments({ roundStatus: ROUND_STATUS.ONGOING });

        if(ongoingRound){
            throw new ApiError(400, "Cannot load leaderboard while a round is ongoing");
        }
        await this.loadLeaderBoard();
        logInfo("Leaderboard refreshed in Redis successfully.");

        return new ApiResponse(200, null, "Leaderboard refreshed successfully");
    })

    createRound = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }

        const { roundName, roundStatus } = req.body;

        if(!roundName){
            throw new ApiError(400, "Round name is required");
        }

        if (roundStatus && !Object.values(ROUND_STATUS).includes(roundStatus)) {
            throw new ApiError(400, "Invalid round status");
        }
        
        const round = await roundModel.create({
            roundName,
            roundStatus: roundStatus || ROUND_STATUS.CREATED
        });
        logInfo(`Round created successfully. Name: ${round.roundName}, Status: ${round.roundStatus}.`);

        await this.loadLeaderBoard();

        return new ApiResponse(201, round, "Round created successfully")
    })

    updateRound = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }
        
        const { roundId } = req.params;
        const { roundName } = req.body;

        if(!roundName){
            throw new ApiError(400, "Round name is required");
        }

        const round = await roundModel.findByIdAndUpdate(roundId, { $set: { roundName } }, { new: true });

        if(!round){
            throw new ApiError(404, "Round not found");
        }
        logInfo(`Round name updated successfully. Name: ${round.roundName}.`);

        return new ApiResponse(200, round, "Round updated successfully")
    })

    updateRoundStatus = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }
        
        const { roundId } = req.params;
        const { status } = req.body;

        if(!Object.values(ROUND_STATUS).includes(status)){
            throw new ApiError(400, "Invalid round status");
        }

        const round = await roundModel.findByIdAndUpdate(roundId, { $set: { roundStatus: status } }, { new: true });

        if(!round){
            throw new ApiError(404, "Round not found");
        }
        logInfo(`Round status updated successfully. Name: ${round.roundName}, Status: ${round.roundStatus}.`);

        return new ApiResponse(200, round, "Round status updated successfully")
    })

    getRounds = asyncHandler(async(req, res) => {

        const rounds = await roundModel.find().lean().select("-__v").sort({ createdAt: -1 });

        return new ApiResponse(200, rounds, "Rounds fetched successfully")
    })

    getRoundSummary = asyncHandler(async(req, res) => {

        const [completedRounds, ongoingRound] = await Promise.all([
            roundModel.countDocuments({ roundStatus: ROUND_STATUS.COMPLETED }),
            roundModel.findOne({ roundStatus: ROUND_STATUS.ONGOING })
                .select("roundName")
                .sort({ updatedAt: -1 })
                .lean(),
        ]);

        return new ApiResponse(
            200,
            {
                completedRounds,
                ongoingRoundName: ongoingRound?.roundName || null,
            },
            "Round summary fetched successfully"
        )
    })

    getRound = asyncHandler(async(req, res) => {

        const roundId = req.params?.roundId;
        const roundName = req.body?.roundName;

        const conditions = [];

        if (roundId) conditions.push({ _id: roundId });
        if (roundName) conditions.push({ roundName });

        if (conditions.length === 0) {
            throw new ApiError(400, "roundId or roundName required");
        }

        const round = await roundModel
            .findOne({ $or: conditions })
            .select("-__v")
            .lean();
            
        if(!round){
            throw new ApiError(404, "Round not found");
        }

        return new ApiResponse(200, round, "Round fetched successfully")
    })

    getLeaderBoard = asyncHandler(async(req, res) => {
        const data = await redisClient.zrevrange("leaderboard", 0, -1, "WITHSCORES");

        const result = [];

        for (let i = 0; i < data.length; i += 2) {
            const [id, name] = data[i].split(":");
            const points = parseInt(data[i + 1], 10);
            result.push({ name, points });
        }
        const leaderBoard = result.sort((a, b) => b.points - a.points);
        if(!leaderBoard || !leaderBoard.length){
            throw new ApiError(404, "Leaderboard not found");
        }
        return new ApiResponse(200, leaderBoard, "Leaderboard fetched successfully")
    })

    deleteRound = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }
        
        const roundId = req.params?.roundId || req.body?.roundId || undefined;

        if(!roundId){
            throw new ApiError(400, "Round ID is required");
        }

        const round = await roundModel.findByIdAndDelete(roundId);

        if(!round){
            throw new ApiError(404, "Round not found");
        }
        logInfo(`Round deleted successfully. Name: ${round.roundName}.`);

        return new ApiResponse(200, null, "Round deleted successfully")
    })

    resetRoundDB = async() => {
            
        try {
            await roundModel.deleteMany({});
            logInfo("Round database reset successfully.");
            return true;
        } catch (error) {
            console.error("Error resetting round database:", error);
            return false;
        }
    }
}

export default new RoundController();