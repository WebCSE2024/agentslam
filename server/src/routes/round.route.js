import { Router } from "express";
import roundController from "../controllers/round.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

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
        // POST /api/round/create  — create a round (admin)
        this.router.post("/create", authMiddleware, roundLimiter, roundController.createRound);

        // GET /api/round  — list all rounds
        this.router.get("/", authMiddleware, roundLimiter, roundController.getRounds);

        // GET /api/round/summary  — completed rounds count + current ongoing round name
        this.router.get("/summary", authMiddleware, roundLimiter, roundController.getRoundSummary);

        // GET /api/round/leaderboard  — fetch leaderboard
        // Must be defined before /:roundId to avoid route conflict
        this.router.get("/leaderboard", authMiddleware, roundLimiter, roundController.getLeaderBoard);

        //POST /api/round/refresh-leaderboard  — refresh leaderboard (admin)
        this.router.post("/refresh-leaderboard", authMiddleware, roundLimiter, roundController.refreshLeaderBoard);
        
        //GET /api/round/info  — get round by id or name
        this.router.get("/info", authMiddleware, roundLimiter, roundController.getRound);

        // GET /api/round/info/:roundId  — get round by id or name
        this.router.get("/info/:roundId", authMiddleware, roundLimiter, roundController.getRound);

        // POST /api/round/update/:roundId  — update round name (admin)
        this.router.post("/update/:roundId", authMiddleware, roundLimiter, roundController.updateRound);

        //DELETE /api/round/delete/:roundId  — delete a round (admin)
        this.router.delete("/delete/:roundId", authMiddleware, roundLimiter, roundController.deleteRound);

        // POST /api/round/update-status/:roundId  — update round status (admin)
        this.router.post("/update-status/:roundId", authMiddleware, roundLimiter, roundController.updateRoundStatus);
    }
}

export default new RoundRouter().router;
