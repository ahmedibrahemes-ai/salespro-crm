const { createServer } = require('http');
const next = require('next');

const app = next({ dev: true, port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    handle(req, res).catch(err => {
      console.error('Handle error:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  });
  
  server.listen(3000, '0.0.0.0', () => {
    console.log(`[${new Date().toISOString()}] Server ready on port 3000`);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err.message);
  });
  
  server.on('close', () => {
    console.error('Server closed!');
  });
  
  // Keep process alive
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[health] RSS: ${Math.round(mem.rss/1024/1024)}MB, Heap: ${Math.round(mem.heapUsed/1024/1024)}/${Math.round(mem.heapTotal/1024/1024)}MB`);
  }, 30000);
}).catch(err => {
  console.error('Prepare error:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received');
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(0);
});
