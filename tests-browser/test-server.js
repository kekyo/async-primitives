import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    const htmlPath = path.join(__dirname, 'test.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  // Serve built library files
  if (url.pathname.startsWith('/dist/')) {
    const filePath = path.join(__dirname, '..', url.pathname);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentType = ext === '.js' ? 'application/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

const port = parseInt(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Test server running on port ${port}`);
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