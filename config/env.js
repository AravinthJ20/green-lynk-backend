const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];

const parseOrigins = (value, fallback) => {
  const sources = [value, fallback]
    .filter(Boolean)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (sources.length === 0) return defaultOrigins;

  return [...new Set([...defaultOrigins, ...sources])];
};

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'strangers-play-secret',
  inviteSecret: process.env.INVITE_SECRET || process.env.JWT_SECRET || 'strangers-play-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN, process.env.FRONTEND_URL || 'http://localhost:3000')
};
