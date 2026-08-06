const http = require('node:http');
const express = require('express');
const createRateLimiter = require('../middleware/rateLimiter');

test('API rate limiter blocks requests after the configured limit', async () => {
  const app = express();
  app.use('/api', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 1 }));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const firstResponse = await fetch(`http://127.0.0.1:${port}/api/ping`);
    const secondResponse = await fetch(`http://127.0.0.1:${port}/api/ping`);
    const body = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(body.error).toBe('Too many requests. Please wait a moment and try again.');
    expect(secondResponse.headers.get('ratelimit')).toMatch(/limit=1/);
    expect(secondResponse.headers.get('ratelimit')).toMatch(/remaining=0/);
    expect(Number(secondResponse.headers.get('retry-after'))).toBeGreaterThan(0);
  } finally {
    server.close();
  }
});
