import { Router } from "express";
import resetController from "../controllers/reset.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

const resetLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 5,
    keyPrefix: "reset",
});

class ResetRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // POST /api/reset/all
        this.router.post("/all", authMiddleware, resetLimiter, resetController.resetAll);

        // POST /api/reset/tournament
        this.router.post("/tournament", authMiddleware, resetLimiter, resetController.resetTournament);
    }
}

export default new ResetRouter().router;