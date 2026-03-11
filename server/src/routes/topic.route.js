import { Router } from "express";
import topicController from "../controllers/topic.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

// 60 requests per minute per user for topic management
const topicLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "topic",
});

class TopicRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // POST /api/topic  — create a single topic (admin)
        this.router.post("/", authMiddleware, topicLimiter, topicController.createTopic);

        // POST /api/topic/batch  — bulk create topics (admin)
        // Must be before /:topicId to avoid conflict
        this.router.post("/batch", authMiddleware, topicLimiter, topicController.createTopicsBatch);

        // GET /api/topic/round/:round  — topics for a specific round
        this.router.get("/round/:round", authMiddleware, topicLimiter, topicController.getRoundTopics);

        // PUT /api/topic/:topicId  — update a topic (admin)
        this.router.put("/:topicId", authMiddleware, topicLimiter, topicController.updateTopic);

        // DELETE /api/topic/:topicId  — delete a topic (admin)
        this.router.delete("/:topicId", authMiddleware, topicLimiter, topicController.deleteTopic);
    }
}

export default new TopicRouter().router;
