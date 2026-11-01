import { request, type Server } from 'node:http';
import { createApp } from './app';

describe('product service', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createApp().listen(0);

    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The product test server did not bind to a TCP address.');
    }

    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns a healthy response from the health endpoint', async () => {
    const response = await new Promise<{
      statusCode: number;
      body: string;
    }>((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/health-check',
          method: 'GET',
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode ?? 0, body });
          });
        }
      );

      req.on('error', reject);
      req.end();
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toMatch(
      /^Welcome to product-service! Health check - \d+$/
    );
  });
});
