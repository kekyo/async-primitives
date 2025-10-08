import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API endpoints for testing
  if (url.pathname === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Test response' }));
    return;
  }

  if (url.pathname === '/api/error') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Test error' }));
    return;
  }

  if (url.pathname === '/api/slow') {
    // Simulate slow response
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Slow response' }));
    }, 100);
    return;
  }

  // Serve test files
  if (url.pathname === '/test.html') {
    const htmlPath = path.join(dirname, 'test.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  // Serve built library files
  if (url.pathname.startsWith('/dist/')) {
    const distRelativePath = url.pathname.slice(1); // remove leading slash
    const filePath = path.join(dirname, '..', distRelativePath);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      let contentType = 'text/plain';
      if (ext === '.js' || ext === '.mjs') {
        contentType = 'application/javascript';
      } else if (ext === '.css') {
        contentType = 'text/css';
      } else if (ext === '.json') {
        contentType = 'application/json';
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

const envPort = process.env.PORT;
const parsedPort = envPort !== undefined ? parseInt(envPort, 10) : NaN;
const listenPort = Number.isNaN(parsedPort) ? 0 : parsedPort;

server.listen(listenPort, () => {
  const address = server.address();
  const actualPort =
    typeof address === 'object' && address !== null ? address.port : listenPort;
  console.log(`Test server running on port ${actualPort}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Test server stopped');
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Test server stopped');
  });
});
