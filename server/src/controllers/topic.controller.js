import topicModel from "../models/topic.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { logInfo } from "../utils/logger.js";

class TopicController{

    createTopic = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
            }

        const { title, description, round, weights } = req.body;
        if(!title || !round || !weights){
            throw new ApiError(400, "Missing required fields");
        }

        const topic = await topicModel.create({
            title: title,
            description: description || "",
            round,
            weights
        });
        logInfo(`Topic created successfully. Title: ${topic.title}.`);

        return new ApiResponse(201, topic, "Topic created successfully");
    })

    createTopicsBatch = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const topics = Array.isArray(req.body?.topics) ? req.body.topics : [];

        if (!topics || !topics.length) {
            throw new ApiError(400, "Topic Array is Required")
        }

        const insertedTopics = await topicModel.insertMany(topics.map(t => ({
            title: t.title,
            description: t.description || "",
            round: t.round,
            weights: t.weights   
        })));

        const insertedEntries = insertedTopics.length;
        const failedEntries = topics.length - insertedEntries;
        logInfo(`Topic batch created successfully. Inserted: ${insertedEntries}, Failed: ${failedEntries}.`);
        return new ApiResponse(201, { insertedEntries, failedEntries }, "Topics created successfully");
    })

    getRoundTopics = asyncHandler(async(req, res) => {
        const { round } = req.params;
        const topics = await topicModel.find({ round }).lean();

        if(!topics.length){
            throw new ApiError(404, "No topics found for this round");
        }
        return new ApiResponse(200, topics, "Topics retrieved successfully");
    })

    getTopicInfo = asyncHandler(async(req, res) => {

        const { topicId } = req.params;
        const topic = await topicModel.findById(topicId).populate('round').lean().select("-__v");

        if(!topic){
            throw new ApiError(404, "Topic not found");
        }
        return new ApiResponse(200, topic, "Topic retrieved successfully");
    })

    updateTopic = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const { topicId } = req.params;
        const { topicName, title, description, weights, round } = req.body;
        const nextTitle = title || topicName;

        if(!nextTitle && !description && !weights && !round){
            throw new ApiError(400, "At least one field is required for update");
        }

        const topic = await topicModel.findByIdAndUpdate(
            topicId,
            { $set: { title: nextTitle, description, weights, round } },
            { new: true }
        );

        if(!topic){
            throw new ApiError(404, "Topic not found");
        }
        logInfo(`Topic updated successfully. Title: ${topic.title}.`);

        return new ApiResponse(200, topic, "Topic updated successfully");
    })

    deleteTopic = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const { topicId } = req.params;

        const topic = await topicModel.findByIdAndDelete(topicId);

        if(!topic){
            throw new ApiError(404, "Topic not found");
        }
        logInfo(`Topic deleted successfully. Title: ${topic.title}.`);

        return new ApiResponse(200, null, "Topic deleted successfully");
    })

    resetTopicDB = async() => {
        
        try {
            await topicModel.deleteMany({});
            logInfo("Topic database reset successfully.");
            return true;
        } catch (error) {
            console.error("Error resetting topic database:", error);
            return false;
        }
    }
}

export default new TopicController();