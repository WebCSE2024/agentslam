import topicModel from "../models/topic.model";
import { asyncHandler } from "../utils/asyncHandler";
import ApiError from "../utils/apierror";
import ApiResponse from "../utils/apiresponse";

class TopicController{

    createTopic = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
            }

        const { topicName, description, round, weights } = req.body;
        if(!topicName || !round || !weights){
            throw new ApiError(400, "Missing required fields");
        }

        const topic = await topicModel.create({
            title: topicName,
            description: description || "",
            round,
            weights
        });

        return new ApiResponse(201, topic, "Topic created successfully");
    })

    createTopicsBatch = asyncHandler(async(req, res) => {

        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const topics = Array.isArray(req.body?.topics) ? req.body.topics : [];

        if (!topics.length) {
            throw new ApiError(400, "Topic Array is Required")
        }

        const success = [];
        const failedEntries = [];
        let failed = 0;

        for (const entry of topics) {
            const { topicName, description, round, weights } = entry;
            if(!topicName || !round || !weights){
                failed += 1;
                continue;
            }
            try {
                const topic = await topicModel.create({
                    title: topicName,
                    description: description || "",
                    round,
                    weights
                });
                success.push(topic);
            } catch (err) {
                failed += 1;
                failedEntries.push({ entry, error: err.message });
            }
        }
        return new ApiResponse(201, { success, failedEntries }, "Topics created successfully");
    })

    getRoundTopics = asyncHandler(async(req, res) => {
        const { round } = req.params;
        const topics = await topicModel.find({ round }).lean();

        if(!topics.length){
            throw new ApiError(404, "No topics found for this round");
        }
        return new ApiResponse(200, topics, "Topics retrieved successfully");
    })

    updateTopic = asyncHandler(async(req, res) => {
        if(!req.user.role || req.user.role !== "admin"){
            throw new ApiError(403, "Forbidden");
        }

        const { topicId } = req.params;
        const { topicName, description, weights, round } = req.body;

        if(!topicName && !description && !weights && !round){
            throw new ApiError(400, "At least one field is required for update");
        }

        const topic = await topicModel.findByIdAndUpdate(
            topicId,
            { $set: { topicName, description, weights, round } },
            { new: true }
        );

        if(!topic){
            throw new ApiError(404, "Topic not found");
        }

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

        return new ApiResponse(200, null, "Topic deleted successfully");
    })
}