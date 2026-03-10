import redisClient from "../config/redisClient.js";
import { verifyToken } from "../utils/authTokens.js";
import { userSessionKey } from "../utils/redisKeys.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.type !== "access") {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = String(decoded.sub);
    const sid = decoded.sid;

    const activeSid = await redisClient.get(userSessionKey(userId));
    if (!activeSid || activeSid !== sid) {
      return res.status(401).json({ message: "Invalid session" });
    }

    req.user = {
      id: userId,
      sid,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Not authenticated" });
  }
};
