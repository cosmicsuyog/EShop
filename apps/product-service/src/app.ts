import express from 'express';

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.get('/', (_req, res) => {
    res.send({ message: 'Hello Product API!' });
  });

  app.get('/health-check', (_req, res) => {
    res.send({
      message: `Welcome to product-service! Health check - ${Date.now()}`,
    });
  });

  return app;
};
