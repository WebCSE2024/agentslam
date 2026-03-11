import redis from "ioredis";

const redisClient = new redis(process.env.REDIS_URI, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});

redisClient.on("connect", () => {
    console.log("Redis connected");
});

redisClient.on("error", (err) => {
    console.error("Redis error", err.message);
});

export default redisClient;