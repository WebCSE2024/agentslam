import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.config.js";
import ipRateLimit from "./middlewares/ipRateLimit.middleware.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import publicMatchRouter from "./routes/publicMatch.route.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5001);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: false,
  })
);
app.use(express.json());
app.use(ipRateLimit);


app.get("/health", async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "server is up",
  });
});

app.use("/api", publicMatchRouter);
app.use(errorMiddleware);

(async () => {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`server-2 listening on ${PORT}`);
  });
})();