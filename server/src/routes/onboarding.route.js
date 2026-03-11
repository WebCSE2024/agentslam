import { Router } from "express";
import onboardingController from "../controllers/onboarding.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

// 30 onboarding requests per minute per user (batch ops can be large)
const onboardingLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: "onboarding",
});

class OnboardingRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // POST /api/onboarding/user  — create a single user (admin)
        this.router.post("/user", authMiddleware, onboardingLimiter, onboardingController.createUser);

        // POST /api/onboarding/users/batch  — bulk create users (admin)
        this.router.post("/users/batch", authMiddleware, onboardingLimiter, onboardingController.createUsersBatch);
    }
}

export default new OnboardingRouter().router;
