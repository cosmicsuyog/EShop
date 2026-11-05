import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createApp } from './app';

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const startServer = async (app: express.Express) => {
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('The test server did not bind to a TCP address.');
  }

  return { server, port: (address as AddressInfo).port };
};

const get = (port: number, path: string, headers = {}) =>
  new Promise<HttpResponse>((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body,
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });

const post = (port: number, path: string, body: unknown, headers = {}) =>
  new Promise<HttpResponse>((resolve, reject) => {
    const serializedBody = JSON.stringify(body);
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(serializedBody),
          ...headers,
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: responseBody,
          });
        });
      }
    );

    req.on('error', reject);
    req.end(serializedBody);
  });

const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

describe('API gateway routing', () => {
  let gateway: Server;
  let productUpstream: Server;
  let authUpstream: Server;
  let gatewayPort: number;
  let productRequest: {
    url?: string;
    authorization?: string;
    requestId?: string;
  };
  let authResetRequest: {
    url?: string;
    cookie?: string;
    body?: unknown;
  };

  beforeAll(async () => {
    productUpstream = express()
      .get('/api/products', (req, res) => {
        productRequest = {
          url: req.originalUrl,
          authorization: req.header('authorization'),
          requestId: req.header('x-request-id'),
        };
        res.status(200).json({ service: 'product', products: [] });
      })
      .listen(0);
    const authApp = express();
    authApp.use(express.json());
    authUpstream = authApp
      .get('/account', (_req, res) => {
        res.status(200).json({ service: 'auth' });
      })
      .post('/api/reset-password-user', (req, res) => {
        authResetRequest = {
          url: req.originalUrl,
          cookie: req.header('cookie'),
          body: req.body,
        };
        res.cookie('passwordResetToken', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/api/reset-password-user',
          maxAge: 0,
        });
        res.status(200).json({ message: 'Password reset successfully.' });
      })
      .listen(0);

    await Promise.all(
      [productUpstream, authUpstream].map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
          })
      )
    );

    const productAddress = productUpstream.address();
    const authAddress = authUpstream.address();
    if (
      !productAddress ||
      typeof productAddress === 'string' ||
      !authAddress ||
      typeof authAddress === 'string'
    ) {
      throw new Error('The mock upstream did not bind to a TCP address.');
    }

    const gatewayInstance = await startServer(
      createApp({
        productServiceUrl: `http://127.0.0.1:${productAddress.port}`,
        authServiceUrl: `http://127.0.0.1:${authAddress.port}`,
      })
    );
    gateway = gatewayInstance.server;
    gatewayPort = gatewayInstance.port;
  }, 20_000);

  afterAll(async () => {
    await Promise.all(
      [gateway, productUpstream, authUpstream]
        .filter((server): server is Server => Boolean(server))
        .map(closeServer)
    );
  }, 20_000);

  it('proxies product requests with query parameters and request headers', async () => {
    const response = await get(
      gatewayPort,
      '/product/api/products?category=books&page=2',
      {
        authorization: 'Bearer test-token',
        'x-request-id': 'request-123',
      }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      service: 'product',
      products: [],
    });
    expect(productRequest).toEqual({
      url: '/api/products?category=books&page=2',
      authorization: 'Bearer test-token',
      requestId: 'request-123',
    });
  });

  it('preserves auth catch-all routing', async () => {
    const response = await get(gatewayPort, '/account');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ service: 'auth' });
  });

  it('forwards the reset cookie and relays its clearing header', async () => {
    const response = await post(
      gatewayPort,
      '/api/reset-password-user',
      { newPassword: 'new password' },
      {
        cookie: 'passwordResetToken=opaque-value',
        origin: 'http://localhost:3000',
      }
    );

    expect(response.statusCode).toBe(200);
    expect(authResetRequest).toEqual({
      url: '/api/reset-password-user',
      cookie: 'passwordResetToken=opaque-value',
      body: { newPassword: 'new password' },
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('passwordResetToken=;'),
      ])
    );
  });

  it('preserves the gateway health endpoint without proxying', async () => {
    const response = await get(gatewayPort, '/gateway-health', {
      origin: 'http://localhost:3000',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Welcome to api-gateway!',
    });
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows credentialed requests from the separate seller app origin', async () => {
    const response = await get(gatewayPort, '/gateway-health', {
      origin: 'http://localhost:3001',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('returns 502 when product-service is unavailable', async () => {
    const unavailableGateway = await startServer(
      createApp({
        productServiceUrl: 'http://127.0.0.1:1',
        authServiceUrl: 'http://127.0.0.1:1',
      })
    );

    try {
      const response = await get(
        unavailableGateway.port,
        '/product/api/products'
      );

      expect(response.statusCode).toBe(502);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Product service is unavailable',
      });
    } finally {
      await closeServer(unavailableGateway.server);
    }
  });
});
