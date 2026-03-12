import redisClient from "../configs/redis.config.js";

export async function socketRateLimit(key, limit = 5, window = 2*60) {

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

export async function sandboxSocketRateLimit(key, limit = 5, window = 2*60) {

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
