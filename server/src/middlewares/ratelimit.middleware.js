import redisClient from "../configs/redis.config.js";

/**
 * Redis-backed fixed-window rate limiter.
 *
 * Two strategies:
 *   rateLimiter.byIp(opts)   — keyed by IP     → use for unauthenticated routes (login)
 *   rateLimiter.byUser(opts) — keyed by userId → use for authenticated routes (after authMiddleware)
 *
 * Options: { windowMs: number, max: number, keyPrefix: string }
 */
class RateLimiter {

    /**
     * Shared core — INCR + EXPIRE in Redis (fixed window, not sliding).
     * @private
     */
    #buildMiddleware({ windowMs, max, keyPrefix, keyFn }) {
        const windowSec = Math.ceil(windowMs / 1000);

        return async (req, res, next) => {
            const identifier = keyFn(req);

            if (!identifier) {
                // Can't resolve requester identity — fail open
                return next();
            }

            const key = `rl:${keyPrefix}:${identifier}`;

            try {
                const count = await redisClient.incr(key);

                // Set TTL only on first hit — window is fixed from first request
                if (count === 1) {
                    await redisClient.expire(key, windowSec);
                }

                if (count > max) {
                    const retryAfter = await redisClient.ttl(key);
                    res.set("Retry-After", String(retryAfter));
                    return res.status(429).json({
                        message: "Too many requests, please try again later.",
                        retryAfter,
                    });
                }

                return next();
            } catch {
                // Redis unavailable — fail open so the app keeps running
                return next();
            }
        };
    }

    /**
     * Rate limit by IP address.
     * For unauthenticated routes where req.user is not yet set (e.g. login).
     */
    byIp({ windowMs, max, keyPrefix }) {
        return this.#buildMiddleware({
            windowMs,
            max,
            keyPrefix,
            keyFn: (req) => req.ip || req.socket?.remoteAddress || "unknown",
        });
    }

    /**
     * Rate limit by authenticated userId.
     * Must be placed AFTER authMiddleware in the middleware chain.
     */
    byUser({ windowMs, max, keyPrefix }) {
        return this.#buildMiddleware({
            windowMs,
            max,
            keyPrefix,
            keyFn: (req) => req.user?.id ?? null,
        });
    }
}

export default new RateLimiter();
