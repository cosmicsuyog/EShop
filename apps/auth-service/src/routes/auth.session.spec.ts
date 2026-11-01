import cookieParser from 'cookie-parser';
import express from 'express';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import prisma from '@packages/libs/prisma/index.js';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import router from './auth.router';

jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    users: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../utils/auth.helper', () => ({
  checkOtpRestrictions: jest.fn(),
  handleForgotPassword: jest.fn(),
  sendOtp: jest.fn(),
  trackOtpRequests: jest.fn(),
  validationRegistrationData: jest.fn(),
  verifyForgotPasswordOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn(),
}));

const ACCESS_SECRET = 'test-access-token-secret';
const REFRESH_SECRET = 'test-refresh-token-secret';
const USER_ID = '507f1f77bcf86cd799439011';
const user = {
  id: USER_ID,
  email: 'customer@example.com',
  name: 'Customer',
  password: 'stored-password-hash',
};

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const signToken = (
  tokenUse: 'access' | 'refresh',
  secret: string,
  expiresIn = '5m'
) =>
  jwt.sign({ id: USER_ID, role: 'user', tokenUse }, secret, {
    expiresIn,
  } as jwt.SignOptions);

describe('customer session endpoints', () => {
  let server: Server;
  let port: number;
  const findUnique = jest.mocked(prisma.users.findUnique);
  const originalAccessSecret = process.env.ACCESS_TOKEN_SECRET;
  const originalRefreshSecret = process.env.REFRESH_TOKEN_SECRET;

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
    process.env.REFRESH_TOKEN_SECRET = REFRESH_SECRET;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', router);
    app.use(errorMiddleware);
    server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error(
        'The auth session test server did not bind to a TCP address.'
      );
    }

    port = (address as AddressInfo).port;
  });

  afterAll(async () => {
    if (originalAccessSecret === undefined) {
      delete process.env.ACCESS_TOKEN_SECRET;
    } else {
      process.env.ACCESS_TOKEN_SECRET = originalAccessSecret;
    }
    if (originalRefreshSecret === undefined) {
      delete process.env.REFRESH_TOKEN_SECRET;
    } else {
      process.env.REFRESH_TOKEN_SECRET = originalRefreshSecret;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    findUnique.mockReset();
  });

  const send = (
    method: 'GET' | 'POST',
    path: string,
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
      req.end(payload);
    });

  const getCurrentUser = (headers: Record<string, string> = {}) =>
    send('GET', '/api/auth/logged-in-user', headers);

  const refresh = (cookie?: string, origin = 'http://localhost:3000') =>
    send('POST', '/api/auth/refresh-token', {
      origin,
      ...(cookie ? { cookie } : {}),
    });

  const logout = (origin = 'http://localhost:3000') =>
    send('POST', '/api/auth/logout-user', { origin });

  it('issues distinct typed access and refresh tokens during login', async () => {
    findUnique.mockResolvedValue(user as never);

    const response = await send(
      'POST',
      '/api/login-user',
      {},
      {
        email: user.email,
        password: 'valid-password',
      }
    );
    const setCookies = response.headers['set-cookie'] as string[];
    const accessToken = setCookies
      .find((cookie) => cookie.startsWith('accessToken='))
      ?.match(/accessToken=([^;]+)/)?.[1];
    const refreshToken = setCookies
      .find((cookie) => cookie.startsWith('refreshToken='))
      ?.match(/refreshToken=([^;]+)/)?.[1];

    expect(response.statusCode).toBe(200);
    expect(jwt.verify(accessToken as string, ACCESS_SECRET)).toMatchObject({
      tokenUse: 'access',
      role: 'user',
    });
    expect(jwt.verify(refreshToken as string, REFRESH_SECRET)).toMatchObject({
      tokenUse: 'refresh',
      role: 'user',
    });
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'accessToken=malformed-token'],
    ['invalid signature', `accessToken=${signToken('access', 'wrong-secret')}`],
    ['expired', `accessToken=${signToken('access', ACCESS_SECRET, '-1s')}`],
    [
      'missing expiration',
      `accessToken=${jwt.sign(
        { id: USER_ID, role: 'user', tokenUse: 'access' },
        ACCESS_SECRET
      )}`,
    ],
  ])('rejects a %s access token', async (_label, cookie) => {
    const response = await getCurrentUser(cookie ? { cookie } : {});

    expect(response.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('authenticates using a valid access-token cookie and returns only safe fields', async () => {
    findUnique.mockResolvedValue(user as never);

    const response = await getCurrentUser({
      cookie: `accessToken=${signToken('access', ACCESS_SECRET)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      user: {
        id: USER_ID,
        email: user.email,
        name: user.name,
      },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, email: true, name: true },
    });
  });

  it('accepts a valid bearer access token', async () => {
    findUnique.mockResolvedValue(user as never);

    const response = await getCurrentUser({
      authorization: `Bearer ${signToken('access', ACCESS_SECRET)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).user).not.toHaveProperty('password');
  });

  it('rejects an access token with an invalid token-use claim', async () => {
    const response = await getCurrentUser({
      cookie: `accessToken=${signToken('refresh', REFRESH_SECRET)}`,
    });

    expect(response.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a valid access token when the user no longer exists', async () => {
    findUnique.mockResolvedValue(null);

    const response = await getCurrentUser({
      cookie: `accessToken=${signToken('access', ACCESS_SECRET)}`,
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).message).toContain('no longer exists');
  });

  it('rejects a missing refresh token', async () => {
    const response = await refresh();

    expect(response.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', 'not-a-jwt'],
    ['expired', signToken('refresh', REFRESH_SECRET, '-1s')],
    ['wrong signature', signToken('refresh', 'wrong-secret')],
    [
      'missing expiration',
      jwt.sign(
        { id: USER_ID, role: 'user', tokenUse: 'refresh' },
        REFRESH_SECRET
      ),
    ],
  ])('rejects an %s refresh token', async (_label, token) => {
    const response = await refresh(`refreshToken=${token}`);

    expect(response.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does not accept an access token as a refresh token even if secrets match', async () => {
    process.env.REFRESH_TOKEN_SECRET = ACCESS_SECRET;
    const accessToken = signToken('access', ACCESS_SECRET);

    const response = await refresh(`refreshToken=${accessToken}`);

    expect(response.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    process.env.REFRESH_TOKEN_SECRET = REFRESH_SECRET;
  });

  it('rejects refresh requests from an untrusted origin', async () => {
    const response = await refresh(
      `refreshToken=${signToken('refresh', REFRESH_SECRET)}`,
      'https://attacker.example'
    );

    expect(response.statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('issues only a short-lived access cookie for a valid refresh token', async () => {
    findUnique.mockResolvedValue(user as never);

    const response = await refresh(
      `refreshToken=${signToken('refresh', REFRESH_SECRET)}`
    );
    const setCookies = response.headers['set-cookie'] as string[];

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Access token refreshed successfully.',
    });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]).toContain('accessToken=');
    expect(setCookies[0]).toContain('Max-Age=900');
    expect(setCookies[0]).toContain('HttpOnly');
    expect(setCookies[0]).toContain('Secure');
    expect(setCookies[0]).toContain('SameSite=None');
    expect(setCookies[0]).not.toContain('refreshToken=');

    const accessToken = setCookies[0].match(/accessToken=([^;]+)/)?.[1];
    expect(accessToken).toBeDefined();
    expect(jwt.verify(accessToken as string, ACCESS_SECRET)).toMatchObject({
      id: USER_ID,
      role: 'user',
      tokenUse: 'access',
    });
  });

  it('rejects refresh tokens for deleted users', async () => {
    findUnique.mockResolvedValue(null);

    const response = await refresh(
      `refreshToken=${signToken('refresh', REFRESH_SECRET)}`
    );

    expect(response.statusCode).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('clears both authentication cookies without claiming token revocation', async () => {
    const response = await logout();
    const setCookies = response.headers['set-cookie'] as string[];

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message:
        'Signed out on this browser. Previously issued access tokens are not revoked.',
    });
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain('accessToken=;');
    expect(setCookies[1]).toContain('refreshToken=;');
    for (const cookie of setCookies) {
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=None');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects logout requests from an untrusted origin', async () => {
    const response = await logout('https://attacker.example');

    expect(response.statusCode).toBe(403);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
