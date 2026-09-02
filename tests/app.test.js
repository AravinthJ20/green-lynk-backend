const http = require('node:http');
const app = require('../src/app');

test('GET / returns the backend running message', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: 'Green Lynk backend is running' });
  } finally {
    server.close();
  }
});
