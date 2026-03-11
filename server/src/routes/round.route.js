import { Router } from "express";
import roundController from "../controllers/round.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import rateLimiter from "../middlewares/ratelimit.middleware";

// 60 requests per minute per user for round management
const roundLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "round",
});

class RoundRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // POST /api/round  — create a round (admin)
        this.router.post("/", authMiddleware, roundLimiter, roundController.createRound);

        // GET /api/round  — list all rounds
        this.router.get("/", authMiddleware, roundLimiter, roundController.getRounds);

        // GET /api/round/leaderboard  — fetch leaderboard
        // Must be defined before /:roundId to avoid route conflict
        this.router.get("/leaderboard", authMiddleware, roundLimiter, roundController.getLeaderBoard);

        // GET /api/round/:roundId  — get round by id or name
        this.router.get("/:roundId", authMiddleware, roundLimiter, roundController.getRound);

        // PUT /api/round/:roundId  — update round name (admin)
        this.router.put("/:roundId", authMiddleware, roundLimiter, roundController.updateRound);
    }
}

export default new RoundRouter().router;
