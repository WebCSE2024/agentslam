import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimiter from "../middlewares/ratelimit.middleware.js";

// 10 login attempts per 15 minutes per IP (no user session yet)
const loginLimiter = rateLimiter.byIp({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: "login",
});

class AuthRouter {
    constructor() {
        this.router = Router();
        this.initRoutes();
    }

    initRoutes() {
        // POST /api/auth/login
        this.router.post("/login", loginLimiter, authController.login);

        // GET /api/auth/me
        this.router.get("/me", authMiddleware, loginLimiter, authController.me);

        // POST /api/auth/logout
        this.router.post("/logout", authMiddleware, authController.logout);
    }
}

export default new AuthRouter().router;
