import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/apierror.js';
import ApiResponse from '../utils/apiresponse.js';
import { USER_ROLE } from '../utils/enum.js';
import userController from './user.controller.js';
import { redisCleanUp } from '../utils/rediskeys.js';
import roundController from './round.controller.js';
import topicController from './topic.controller.js';
import matchController from './match.controller.js';
import socketService from '../services/socket.service.js';
import { logInfo } from '../utils/logger.js';
class ResetController {

    resetAll = asyncHandler(async (req, res) => {

            if(!req.user.role || req.user.role !== "admin"){
                throw new ApiError(403, "Forbidden");
            }

            try {
                const userAck = await userController.resetUserDB();
                const roundAck = await roundController.resetRoundDB();
                const topicAck = await topicController.resetTopicDB();
                const matchAck = await matchController.resetMatchDB();
                const socketAck = socketService.resetSocketStore();
                const redisAck = await redisCleanUp();
                if(userAck && roundAck && topicAck && matchAck && socketAck && redisAck){
                    logInfo('All databases, socket store, and Redis state reset successfully.');
                    return new ApiResponse(200, null, "All rounds, topics, matches, sockets reset successfully");
                }else{
                    throw new ApiError(400, 'Error reseting tournament')
                }
            }catch (error) {
                throw new ApiError(500, "Failed to reset all users");
            }
    })

    resetTournament = asyncHandler(async (req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        try {
            const userAck = await userController.resetUsers();
            const roundAck = await roundController.resetRoundDB();
            const topicAck = await topicController.resetTopicDB();
            const matchAck = await matchController.resetMatchDB();
            const socketAck = socketService.resetSocketStore();
            const redisAck = await redisCleanUp();

            if(userAck && roundAck && topicAck && matchAck && socketAck && redisAck){
                logInfo('Tournament state reset successfully for users, rounds, topics, matches, sockets, and Redis.');
                return new ApiResponse(200, null, "All rounds, topics, matches, sockets reset successfully");
            }else{
                throw new ApiError(400, 'Error reseting tournament')
            }
        } catch (error) {
            throw new ApiError(500, "Failed to reset tournament data");
        }
    })
}

export default new ResetController();