import redisClient from "../configs/redis.config.js";
import { signAccessToken, verifyToken, getCookieOptions } from "../utils/authtoken.js";
import { userSessionKey } from "../utils/rediskeys.js";
import userModel from "../models/user.model.js";
import { USER_STATUS } from "../utils/enum.js";

export const authMiddleware = async (req, res, next) => {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (accessToken) {
    try {
      const decoded = verifyToken(accessToken);

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
    } catch (err) {
      // Only fall through on expiry; any other JWT error is a hard reject
      if (err.name !== "TokenExpiredError") {
        return res.status(401).json({ message: "Not authenticated" });
      }
    }
  }

  // fallback to refresh token if access token is missing or expired
  if (!refreshToken) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = String(decoded.sub);
    const sid = decoded.sid;

    // Verify the session is still alive in Redis
    const activeSid = await redisClient.get(userSessionKey(userId));
    if (!activeSid || activeSid !== sid) {
      return res.status(401).json({ message: "Session expired, please log in again" });
    }

    const user = await userModel.findById(userId).select("_id name email role status");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.status === USER_STATUS.DISABLED) {
      // Clean up stale session and cookies
      await redisClient.del(userSessionKey(userId));
      res.clearCookie("access_token", getCookieOptions({ httpOnly: true }));
      res.clearCookie("refresh_token", getCookieOptions({ httpOnly: true }));
      return res.status(403).json({ message: "Account is disabled" });
    }

    // Issue fresh access token — same session, same sid, no rotation needed
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      sid,
      role: user.role,
      username: user.name,
      email: user.email,
    });

    res.cookie("access_token", newAccessToken, getCookieOptions({ httpOnly: true }));

    req.user = {
      id: user._id.toString(),
      sid,
      username: user.name,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Not authenticated" });
  }
};
