const { test } = require('node:test');
const assert = require('node:assert');

function loadEnv() {
  delete require.cache[require.resolve('../config/env')];
  return require('../config/env');
}

test('corsOrigins parses comma-separated origin values', async (t) => {
  process.env.CORS_ORIGINS = 'http://localhost:3000, http://example.com';
  const env = loadEnv();
  assert.deepStrictEqual(env.corsOrigins, ['http://localhost:3000', 'http://example.com']);
  delete process.env.CORS_ORIGINS;
});

test('corsOrigins parses JSON array formatted origins', async (t) => {
  process.env.CORS_ORIGINS = '["http://localhost:3000", "http://example.com"]';
  const env = loadEnv();
  assert.deepStrictEqual(env.corsOrigins, ['http://localhost:3000', 'http://example.com']);
  delete process.env.CORS_ORIGINS;
});
