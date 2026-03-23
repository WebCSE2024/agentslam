// Short window (1 minute) to keep Map size small and O(N) cleanup fast on 512MB RAM VM
const WINDOW_MS = 1 * 60 * 1000;
const MAX_REQUESTS = 100;

const buckets = new Map();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 10 * 1000; // 10 seconds

function cleanup(now) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [ip, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(ip);
  }
}

export default function ipRateLimit(req, res, next) {
  const now = Date.now();
  cleanup(now);

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      success: false,
      message: "Too many requests. Try again later.",
    });
  }

  bucket.count += 1;
  return next();
}