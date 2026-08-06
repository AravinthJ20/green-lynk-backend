function loadEnv() {
  jest.resetModules();
  return require('../config/env');
}

function restoreEnv(previousValues) {
  Object.entries(previousValues).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

test('corsOrigins parses comma-separated origin values', () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  const previousCorsOrigins = process.env.CORS_ORIGINS;

  process.env.CORS_ORIGINS = 'http://localhost:3000, http://example.com';
  process.env.CORS_ORIGIN = '';
  process.env.FRONTEND_URL = '';

  const env = loadEnv();

  expect(env.corsOrigins).toEqual(['http://localhost:3000', 'http://example.com']);

  restoreEnv({
    CORS_ORIGINS: previousCorsOrigins,
    CORS_ORIGIN: previousCorsOrigin,
    FRONTEND_URL: previousFrontendUrl
  });
});

test('corsOrigins parses JSON array formatted origins', () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  const previousCorsOrigins = process.env.CORS_ORIGINS;

  process.env.CORS_ORIGINS = '["http://localhost:3000", "http://example.com"]';
  process.env.CORS_ORIGIN = '';
  process.env.FRONTEND_URL = '';

  const env = loadEnv();

  expect(env.corsOrigins).toEqual(['http://localhost:3000', 'http://example.com']);

  restoreEnv({
    CORS_ORIGINS: previousCorsOrigins,
    CORS_ORIGIN: previousCorsOrigin,
    FRONTEND_URL: previousFrontendUrl
  });
});

test('API rate limit settings parse positive numeric env values', () => {
  const previousWindowMs = process.env.API_RATE_LIMIT_WINDOW_MS;
  const previousMaxRequests = process.env.API_RATE_LIMIT_MAX_REQUESTS;

  process.env.API_RATE_LIMIT_WINDOW_MS = '30000';
  process.env.API_RATE_LIMIT_MAX_REQUESTS = '50';

  const env = loadEnv();

  expect(env.apiRateLimitWindowMs).toBe(30000);
  expect(env.apiRateLimitMaxRequests).toBe(50);

  restoreEnv({
    API_RATE_LIMIT_WINDOW_MS: previousWindowMs,
    API_RATE_LIMIT_MAX_REQUESTS: previousMaxRequests
  });
});
