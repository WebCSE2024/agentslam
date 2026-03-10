import roundModel from "../models/round.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { MATCH_STATUS, ROUND_STATUS, TOPIC_TYPE } from "../utils/enum.js";
import redisClient from "../config/redis.config.js";
import topicModel from "../models/topic.model.js";

class RoundController{

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

        return new ApiResponse(201, round, "Round created successfully")
    })

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
                const match = await topicModel.create({
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
}

export default new RoundController();