import { createServer } from 'http';
import next from 'next';

const app = next({ dev: true, port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });
  
  server.listen(3000, '0.0.0.0', () => {
    console.log('Server ready on port 3000');
  });
  
  // Prevent process from exiting
  setInterval(() => {}, 60000);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
