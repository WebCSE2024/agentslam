import { Router } from "express";
import matchController from "../controllers/match.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

// 60 requests per minute per user for match management
const matchLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "match",
});

class MatchRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // --- Admin: match lifecycle ---

        // POST /api/match/generate  — generate matches for a round (admin)
        this.router.post("/generate", authMiddleware, matchLimiter, matchController.generateMatches);

        // POST /api/match/:matchId/activate  — load match into Redis, open socket room (admin)
        this.router.post("/:matchId/activate", authMiddleware, matchLimiter, matchController.activateMatch);

        // POST /api/match/:matchId/start  — start the timer and match (admin)
        this.router.post("/:matchId/start", authMiddleware, matchLimiter, matchController.startMatch);

        // POST /api/match/:matchId/pause  — pause an ongoing match (admin)
        this.router.post("/:matchId/pause", authMiddleware, matchLimiter, matchController.pauseMatch);

        // POST /api/match/:matchId/resume  — resume a paused match (admin)
        this.router.post("/:matchId/resume", authMiddleware, matchLimiter, matchController.resumeMatch);

        // PUT /api/match/:matchId/result  — manually set scores and winner (admin)
        this.router.put("/:matchId/result", authMiddleware, matchLimiter, matchController.updateManualMatchResult);

        // --- Read operations ---

        // GET /api/match  — all matches (admin)
        this.router.get("/", authMiddleware, matchLimiter, matchController.getAllMatches);

        // GET /api/match/round/:roundId  — matches for a round
        // Must be before /:matchId to avoid conflict
        this.router.get("/round/:roundId", authMiddleware, matchLimiter, matchController.getMatchByRound);

        // GET /api/match/:matchId  — single match info
        this.router.get("/:matchId", authMiddleware, matchLimiter, matchController.getMatchInfo);
    }
}

export default new MatchRouter().router;
