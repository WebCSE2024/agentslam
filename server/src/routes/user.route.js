import { Router } from "express";
import userController from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

// 30 requests per minute per user for general user endpoints
const userLimiter = rateLimiter.byUser({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: "user",
});

// Stricter limit per user for password reset (has an email side-effect)
const resetPasswordLimiter = rateLimiter.byUser({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: "reset-password",
});

class UserRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // GET /api/user/profile  — own profile
        this.router.get("/profile", authMiddleware, userLimiter, userController.getUserProfile);

        // GET /api/user  — all users filtered by role (admin)
        this.router.get("/", authMiddleware, userLimiter, userController.getAllUsers);

        // GET /api/user/filter  — users filtered by status (admin)
        this.router.get("/filter", authMiddleware, userLimiter, userController.getUsersByFilter);

        // GET /api/user/info  — get user by username
        this.router.get("/info", authMiddleware, userLimiter, userController.getUserInfo);

        // GET /api/user/info/:id  — get user by id or username
        this.router.get("/info/:id", authMiddleware, userLimiter, userController.getUserInfo);

        // POST /api/user/reset-password  — reset a user's password (admin)
        this.router.post("/reset-password", authMiddleware, resetPasswordLimiter, userController.resetPassword);

        // POST /api/user/change-status  — toggle user status between active and disabled (admin)
        this.router.post("/change-status", authMiddleware, userLimiter, userController.changeStatusManually);
    }
}

export default new UserRouter().router;
