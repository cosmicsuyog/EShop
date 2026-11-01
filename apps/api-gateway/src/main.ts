import { createApp } from './app';

const port = process.env.PORT || 8000;
const app = createApp();
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
server.on('error', console.error);
