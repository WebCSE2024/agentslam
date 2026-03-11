import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import rateLimiter from "../middlewares/ratelimit.middleware";

// 10 login attempts per 15 minutes per IP (no user session yet)
const loginLimiter = rateLimiter.byIp({
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
        this.router.get("/me", authMiddleware, authController.me);

        // POST /api/auth/logout
        this.router.post("/logout", authMiddleware, authController.logout);
    }
}

export default new AuthRouter().router;
