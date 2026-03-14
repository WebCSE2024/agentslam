import redisClient from "../configs/redis.config.js";

const DEFAULT_SOCKET_LIMIT = Number(process.env.SOCKET_MESSAGE_LIMIT || 5);
const DEFAULT_SOCKET_WINDOW_SEC = Number(process.env.SOCKET_WINDOW_TIME_SEC || 2 * 60);
const DEFAULT_SANDBOX_LIMIT = Number(process.env.SANDBOX_MSG_LIMIT || DEFAULT_SOCKET_LIMIT);
const DEFAULT_SANDBOX_WINDOW_SEC = Number(process.env.SANDBOX_MSG_WINDOW_SEC || DEFAULT_SOCKET_WINDOW_SEC);

export async function socketRateLimit(key, limit = DEFAULT_SOCKET_LIMIT, window = DEFAULT_SOCKET_WINDOW_SEC) {

  try {
    const redisKey = `socket:rl:${key}`;
  
    const count = await redisClient.incr(redisKey);
  
    if (count === 1) {
      await redisClient.expire(redisKey, window);
    }
  
    if (count > limit) {
      return false;
    }
  
    return true;
  } catch (error) {
    console.error("Error occurred while checking socket rate limit:", error);
    return true;
  }
}

export async function sandboxSocketRateLimit(key, limit = DEFAULT_SANDBOX_LIMIT, window = DEFAULT_SANDBOX_WINDOW_SEC) {

  try {
    const redisKey = `socket:rl:${key}`;
  
    const count = await redisClient.incr(redisKey);
  
    if (count === 1) {
      await redisClient.expire(redisKey, window);
    }
  
    if (count > limit) {
      return false;
    }
  
    return true;
  } catch (error) {
    console.error("Error occurred while checking socket rate limit:", error);
    return false;
  }
}
