import redisClient from "../configs/redis.config.js";

export function userSessionKey(userId) {
  return `session:user:${userId}`;
}

export function refreshJtiKey(sessionId) {
  return `session:refreshJti:${sessionId}`;
}

export async function redisCleanUp(){
  try {
    await redisClient.flushAll();
    console.log("Redis DB cleared successfully");
  } catch (error) {
    console.error("Error clearing Redis DB:", error);
  }
}