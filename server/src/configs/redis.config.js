import redis from "ioredis";

const redisClient = new redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,

}); // Change to URL based before Deploy....

redisClient.on("connect", () => {
    console.log("Redis connected");
});

redisClient.on("error", (err) => {
    console.log("Redis error", err);
});

export default redisClient;