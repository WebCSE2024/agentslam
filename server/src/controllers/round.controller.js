import roundModel from "../models/round.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { ROUND_STATUS, } from "../utils/enum.js";
import redisClient from "../configs/redis.config.js";

class RoundController{

    loadLeaderBoard = async()=>{

        const leaderBoardPresent = await redisClient.exists("leaderboard");
        if(!leaderBoardPresent){

            const teams = await userModel.find({}).lean().select("_id username")
            for(const team of teams){
                await redisClient.zadd("leaderboard", 0, `${team._id}:${team.username}`)
            }
        }

        return;
    }

    createRound = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const { roundName } = req.body;

        if(!roundName){
            throw new ApiError(400, "Round name is required");
        }
        
        const round = await roundModel.create({
            roundName,
            roundStatus: ROUND_STATUS.CREATED
        });

        this.loadLeaderBoard();

        return new ApiResponse(201, round, "Round created successfully")
    })

    updateRound = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }
        
        const { roundId } = req.params;
        const { roundName } = req.body;

        const round = await roundModel.findByIdAndUpdate(roundId, { roundName }, { new: true });

        if(!round){
            throw new ApiError(404, "Round not found");
        }

        return new ApiResponse(200, round, "Round updated successfully")
    })

    getRounds = asyncHandler(async(req, res) => {

        const rounds = await roundModel.find().lean().select("-__v").sort({ createdAt: -1 });

        return new ApiResponse(200, rounds, "Rounds fetched successfully")
    })

    getRound = asyncHandler(async(req, res) => {

        const { roundId } = req.params;
        const {roundName} = req.body;

        if(!roundId || !roundName){
            throw new ApiError(400, "Round ID or name or status required");
        }
        const round = await roundModel.find({
            $or:[
                { _id: roundId },
                { roundName: roundName },
            ]
        }).lean().select("-__v");
            
        if(!round){
            throw new ApiError(404, "Round not found");
        }

        return new ApiResponse(200, round, "Round fetched successfully")
    })

    getLeaderBoard = asyncHandler(async(req, res) => {
        const leaderBoard = await redisClient.zrevrange("leaderboard", 0, -1);

        if(!leaderBoard || !leaderBoard.length){
            throw new ApiError(404, "Leaderboard not found");
        }
        return new ApiResponse(200, leaderBoard, "Leaderboard fetched successfully")
    })

    resetRoundDB = async() => {
            
        try {
            await roundModel.deleteMany({});
            console.log("Round database reset successfully");
        } catch (error) {
            console.error("Error resetting round database:", error);
        }
        return;
    }
}

export default new RoundController();