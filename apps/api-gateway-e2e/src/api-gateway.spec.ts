import express from 'express';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../api-gateway/src/app';

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const listen = async (app: express.Express) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('The E2E server did not bind to an ephemeral TCP port.');
  }
  return { server, port: (address as AddressInfo).port };
};

const send = (
  port: number,
  path: string,
  method: 'GET' | 'OPTIONS' | 'POST',
  headers: Record<string, string> = {},
  body?: unknown
) =>
  new Promise<HttpResponse>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (responseBody += chunk));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: responseBody,
          })
        );
      }
    );
    req.on('error', reject);
    req.end(payload);
  });

const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );

describe('gateway integration boundaries', () => {
  let gateway: Server;
  let authService: Server;
  let productService: Server;
  let gatewayPort: number;

  beforeAll(async () => {
    const auth = await listen(
      express()
        .use(express.json())
        .post('/login-user', (req, res) =>
          res
            .cookie('refreshToken', 'opaque-test-cookie', {
              httpOnly: true,
              secure: true,
            })
            .status(200)
            .json({ received: req.body })
        )
    );
    authService = auth.server;
    const product = await listen(
      express().get('/api/categories', (_req, res) =>
        res.status(200).json({ categories: ['Accessories'] })
      )
    );
    productService = product.server;

    const app = createApp({
      authServiceUrl: `http://127.0.0.1:${auth.port}`,
      productServiceUrl: `http://127.0.0.1:${product.port}`,
    });
    const upstream = await listen(app);
    gateway = upstream.server;
    gatewayPort = upstream.port;
  });

  afterAll(async () => {
    await Promise.all([close(gateway), close(authService), close(productService)]);
  });

  it('proxies customer authentication, preserves cookies, and allows storefront CORS', async () => {
    const response = await send(
      gatewayPort,
      '/login-user',
      'POST',
      { origin: 'http://localhost:3000' },
      { email: 'buyer@example.test' }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      received: { email: 'buyer@example.test' },
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=opaque-test-cookie')])
    );
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('routes product catalog requests to the product service', async () => {
    const response = await send(
      gatewayPort,
      '/product/api/categories',
      'GET'
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ categories: ['Accessories'] });
  });

  it('allows credentialed preflight requests from the isolated seller UI origin', async () => {
    const response = await send(gatewayPort, '/api/logged-in-seller', 'OPTIONS', {
      origin: 'http://localhost:3001',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization,content-type',
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
