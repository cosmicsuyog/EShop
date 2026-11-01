import express from 'express';
import { request, type Server } from 'node:http';
import type { Request, Response } from 'express';
import router from './auth.router';

jest.mock('../controllers/auth.controller', () => {
  const handler = (_request: Request, response: Response) =>
    response.sendStatus(204);

  return {
    loginUser: handler,
    resetUserPassword: handler,
    userForgotPassword: handler,
    userRegistration: handler,
    verifyUser: handler,
    verifyUserForgetPassword: handler,
  };
});

jest.mock('../controllers/seller.controller', () => {
  const handler = (_request: Request, response: Response) =>
    response.sendStatus(204);

  return {
    createShop: handler,
    getLoggedInSeller: handler,
    loginSeller: handler,
    logoutSeller: handler,
    refreshSellerAccessToken: handler,
    registerSeller: handler,
    verifySeller: handler,
  };
});

describe('auth router', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use('/api', router);
    server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The auth test server did not bind to a TCP address.');
    }

    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('routes password reset requests to the controller', async () => {
    const response = await new Promise<number>((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/reset-password-user',
          method: 'POST',
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        }
      );

      req.on('error', reject);
      req.end();
    });

    expect(response).toBe(204);
  });
});
