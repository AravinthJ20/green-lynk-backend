const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../app');

test('GET / returns the backend running message', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(body, { message: 'Green Lynk backend is running' });
  } finally {
    server.close();
  }
});
