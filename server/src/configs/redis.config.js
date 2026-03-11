import redis from "ioredis";

const redisClient = new redis({
    url: process.env.REDIS_URI
}); 

redisClient.on("connect", () => {
    console.log("Redis connected");
});

redisClient.on("error", (err) => {
    console.log("Redis error", err);
});

export default redisClient;