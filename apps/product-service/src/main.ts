import { createApp } from './app.js';

const port = process.env.PORT || 6002;
const server = createApp().listen(port, () => {
  console.log(`Product service is listening at http://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('Product service server error:', error);
});
