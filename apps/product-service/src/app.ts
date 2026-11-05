import express from 'express';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from '@packages/error-handler/error-middleware.js';
import productRouter from './routes/product.router.js';

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/', (_req, res) => {
    res.send({ message: 'Hello Product API!' });
  });

  app.get('/health-check', (_req, res) => {
    res.send({
      message: `Welcome to product-service! Health check - ${Date.now()}`,
    });
  });

  app.use('/api', productRouter);
  app.use(errorMiddleware);

  return app;
};
