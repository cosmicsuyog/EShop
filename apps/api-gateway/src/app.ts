import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import proxy from 'express-http-proxy';
import morgan from 'morgan';

type GatewayOptions = {
  authServiceUrl?: string;
  productServiceUrl?: string;
};

const unavailableUpstream = (service: string) =>
  (error: Error, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }

    return res.status(502).json({
      error: `${service} is unavailable`,
    });
  };

export const createApp = (options: GatewayOptions = {}) => {
  const app = express();
  const productServiceUrl =
    options.productServiceUrl ??
    process.env.PRODUCT_SERVICE_URL ??
    'http://localhost:6002';
  const authServiceUrl =
    options.authServiceUrl ??
    process.env.AUTH_SERVICE_URL ??
    'http://localhost:6001';

  app.use(
    cors({
      origin: [process.env.USER_UI_ORIGIN ?? 'http://localhost:3000'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  app.use(morgan('dev'));
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
  app.use(cookieParser());
  app.set('trust proxy', 1);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: (req: express.Request & { user?: unknown }) =>
      req.user ? 1000 : 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: true,
  });

  app.use(limiter);

  app.get('/gateway-health', (_req, res) => {
    res.send({ message: 'Welcome to api-gateway!' });
  });

  app.use(
    '/product',
    proxy(productServiceUrl, {
      proxyErrorHandler: unavailableUpstream('Product service'),
    })
  );
  app.use(
    '/',
    proxy(authServiceUrl, {
      proxyErrorHandler: unavailableUpstream('Auth service'),
    })
  );

  return app;
};
