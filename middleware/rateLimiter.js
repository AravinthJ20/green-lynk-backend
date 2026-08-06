const { rateLimit } = require('express-rate-limit');

const createRateLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 120,
  message = 'Too many requests. Please wait a moment and try again.'
} = {}) =>
  rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: { error: message }
  });

module.exports = createRateLimiter;
