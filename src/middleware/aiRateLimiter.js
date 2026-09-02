const { rateLimitWindowMs, rateLimitMaxRequests } = require('../config/ai');

const requestCounts = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now - entry.start >= rateLimitWindowMs) {
      requestCounts.delete(key);
    }
  }
};

const cleanupTimer = setInterval(cleanup, rateLimitWindowMs);
cleanupTimer.unref?.();

const aiRateLimiter = (req, res, next) => {
  const key = req.user?._id?.toString() || req.ip;
  const now = Date.now();
  const entry = requestCounts.get(key) || { start: now, count: 0 };

  if (now - entry.start >= rateLimitWindowMs) {
    entry.start = now;
    entry.count = 0;
  }

  entry.count += 1;
  requestCounts.set(key, entry);

  if (entry.count > rateLimitMaxRequests) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait a moment and try again.' });
  }

  return next();
};

module.exports = aiRateLimiter;
