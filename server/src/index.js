import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";

import { connectDB } from "./configs/db.config.js";
import bullmqService from "./services/bullmq.service.js";
import socketService from "./services/socket.service.js";

import authRouter from "./routes/auth.route.js";
import onboardingRouter from "./routes/onboarding.route.js";
import userRouter from "./routes/user.route.js";
import roundRouter from "./routes/round.route.js";
import topicRouter from "./routes/topic.route.js";
import matchRouter from "./routes/match.route.js";
import resetRouter from "./routes/reset.route.js";

import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";

const PORT = process.env.PORT || 8000;

//  Express app 
const app = express();

// Trust first proxy so req.ip reflects real client IP (needed for rate limiter)
app.set("trust proxy", 1);

//  Core middleware 
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

//  Health check 
app.get("/health", (_req, res) => res.json({ status: "ok" }));

//  API Routes 
app.use("/api/auth",        authRouter);
app.use("/api/onboarding",  onboardingRouter);
app.use("/api/user",        userRouter);
app.use("/api/round",       roundRouter);
app.use("/api/topic",       topicRouter);
app.use("/api/match",       matchRouter);
app.use("/api/reset",       resetRouter); 

//  404 + Global error handler (must be last) 
app.use(notFoundHandler);
app.use(errorHandler);

//   HTTP server 
const server = http.createServer(app);

//  WebSocket (WS upgrade is handled inside socketService, not by Express) 
socketService.init(server);

//  BullMQ worker event listeners 
bullmqService.init();

//  Graceful shutdown 
const shutdown = async (signal) => {
    console.log(`\n[${signal}] Shutting down gracefully…`);

    server.close(() => {
        console.log("HTTP + WS server closed.");
        process.exit(0);
    });

    // Force-kill if graceful close takes too long
    setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    shutdown("unhandledRejection");
});

//  Boot 
const start = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT} [${process.env.NODE_ENV ?? "development"}]`);
    });
};

start();
