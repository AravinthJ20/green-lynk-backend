const parseOrigins = (value, fallback) => {
  const resolved = value || fallback;
  if (!resolved) return ['http://localhost:3000'];

  return resolved
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'strangers-play-secret',
  inviteSecret: process.env.INVITE_SECRET || process.env.JWT_SECRET || 'strangers-play-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN, process.env.FRONTEND_URL || 'http://localhost:3000')
};
