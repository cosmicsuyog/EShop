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
    sellers: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    shops: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../utils/auth.helper', () => ({
  checkOtpRestrictions: jest.fn(),
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  handleForgotPassword: jest.fn(),
  sendOtp: jest.fn(),
  trackOtpRequests: jest.fn(),
  validationRegistrationData: jest.fn(),
  verifyForgotPasswordOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-seller-password'),
}));

const ACCESS_SECRET = 'seller-test-access-token-secret';
const REFRESH_SECRET = 'seller-test-refresh-token-secret';
const SELLER_A = '507f1f77bcf86cd799439011';
const SELLER_B = '607f1f77bcf86cd799439012';
const sellerProfile = {
  id: SELLER_A,
  name: 'Seller One',
  email: 'seller@example.com',
  phone_number: '+1 555 0100',
  country: 'United States',
};

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const tokenFor = (id: string, role: 'seller' | 'user' = 'seller') =>
  jwt.sign({ id, role, tokenUse: 'access' }, ACCESS_SECRET, {
    expiresIn: '5m',
  });

const refreshTokenFor = (id = SELLER_A) =>
  jwt.sign({ id, role: 'seller', tokenUse: 'refresh' }, REFRESH_SECRET, {
    expiresIn: '5m',
  });

describe('seller authentication and owned-shop routes', () => {
  let server: Server;
  let port: number;
  const sellerFindUnique = jest.mocked(prisma.sellers.findUnique);
  const sellerCreate = jest.mocked(prisma.sellers.create);
  const shopFindUnique = jest.mocked(prisma.shops.findUnique);
  const shopCreate = jest.mocked(prisma.shops.create);
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
      throw new Error('The seller test server did not bind to a TCP address.');
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
    jest.clearAllMocks();
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

  const sellerCookie = (id = SELLER_A) => `seller-access-token=${tokenFor(id)}`;

  it('rejects seller registrations missing reference-required fields', async () => {
    const response = await send(
      'POST',
      '/api/seller-registration',
      {},
      {
        name: 'Seller',
        email: 'seller@example.com',
        password: 'password',
      }
    );

    expect(response.statusCode).toBe(400);
    expect(sellerFindUnique).not.toHaveBeenCalled();
  });

  it('starts seller registration with the shared email OTP workflow', async () => {
    sellerFindUnique.mockResolvedValue(null);

    const response = await send(
      'POST',
      '/api/seller-registration',
      {},
      {
        name: 'Seller One',
        email: ' Seller@Example.com ',
        password: 'password',
        phone_number: '+1 555 0100',
        country: 'United States',
      }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      message: 'OTP sent to email. Please verify your account.',
    });
    expect(sellerFindUnique).toHaveBeenCalledWith({
      where: { email: 'seller@example.com' },
      select: { id: true },
    });
  });

  it('verifies an OTP, creates a seller, and returns only safe profile data', async () => {
    sellerFindUnique.mockResolvedValue(null);
    sellerCreate.mockResolvedValue(sellerProfile as never);

    const response = await send(
      'POST',
      '/api/verify-seller',
      {},
      {
        name: 'Seller One',
        email: 'seller@example.com',
        password: 'plain-password',
        phone_number: '+1 555 0100',
        country: 'United States',
        otp: '1234',
      }
    );
    const body = JSON.parse(response.body);
    const cookies = response.headers['set-cookie'] as string[];

    expect(response.statusCode).toBe(201);
    expect(body.seller).toEqual(sellerProfile);
    expect(body).not.toHaveProperty('password');
    expect(sellerCreate).toHaveBeenCalledWith({
      data: {
        name: 'Seller One',
        email: 'seller@example.com',
        password: 'hashed-seller-password',
        phone_number: '+1 555 0100',
        country: 'United States',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        country: true,
      },
    });
    const authHelpers = jest.requireMock('../utils/auth.helper') as {
      verifyOtp: jest.Mock;
    };
    expect(authHelpers.verifyOtp).toHaveBeenCalledWith(
      'seller@example.com',
      '1234'
    );
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('seller-access-token=');
    expect(cookies[1]).toContain('seller-refresh-token=');
    expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
  });

  it('rejects malformed registration OTP values', async () => {
    const response = await send(
      'POST',
      '/api/verify-seller',
      {},
      {
        name: 'Seller One',
        email: 'seller@example.com',
        password: 'plain-password',
        phone_number: '+1 555 0100',
        country: 'United States',
        otp: '12',
      }
    );

    expect(response.statusCode).toBe(400);
    expect(sellerCreate).not.toHaveBeenCalled();
  });

  it('logs in valid seller credentials without returning the password hash', async () => {
    sellerFindUnique.mockResolvedValue({
      ...sellerProfile,
      password: 'stored-hash',
    } as never);
    const bcrypt = jest.requireMock('bcryptjs') as {
      compare: jest.Mock;
    };
    bcrypt.compare.mockResolvedValue(true);

    const response = await send(
      'POST',
      '/api/login-seller',
      {},
      {
        email: sellerProfile.email,
        password: 'valid-password',
      }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).seller).toEqual(sellerProfile);
    expect(response.body).not.toContain('stored-hash');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('seller-access-token='),
        expect.stringContaining('seller-refresh-token='),
      ])
    );
  });

  it('rejects invalid seller credentials without setting session cookies', async () => {
    sellerFindUnique.mockResolvedValue({
      ...sellerProfile,
      password: 'stored-hash',
    } as never);
    const bcrypt = jest.requireMock('bcryptjs') as {
      compare: jest.Mock;
    };
    bcrypt.compare.mockResolvedValue(false);

    const response = await send(
      'POST',
      '/api/login-seller',
      {},
      {
        email: sellerProfile.email,
        password: 'wrong-password',
      }
    );

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).message).toBe(
      'Invalid email or password.'
    );
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('does not accept customer tokens for seller routes or seller cookies for customer routes', async () => {
    const sellerResponse = await send('GET', '/api/logged-in-seller', {
      cookie: `accessToken=${tokenFor(SELLER_A, 'user')}`,
    });
    const customerResponse = await send('GET', '/api/auth/logged-in-user', {
      cookie: sellerCookie(),
    });

    expect(sellerResponse.statusCode).toBe(401);
    expect(customerResponse.statusCode).toBe(401);
    expect(sellerFindUnique).not.toHaveBeenCalled();
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  it('rejects shop creation without an authenticated seller', async () => {
    const response = await send(
      'POST',
      '/api/create-shop',
      {},
      {
        name: 'My Shop',
        bio: 'A helpful shop',
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
        category: 'clothing',
      }
    );

    expect(response.statusCode).toBe(401);
    expect(shopCreate).not.toHaveBeenCalled();
  });

  it('creates a shop for the verified seller, ignoring a supplied seller ID', async () => {
    sellerFindUnique.mockResolvedValue(sellerProfile as never);
    shopFindUnique.mockResolvedValue(null);
    shopCreate.mockResolvedValue({
      id: '507f1f77bcf86cd799439099',
      name: 'My Shop',
      bio: 'A helpful shop',
      address: '1 Market Street',
      opening_hours: 'Mon-Fri 9-5',
      website: null,
      category: 'clothing',
    } as never);

    const response = await send(
      'POST',
      '/api/create-shop',
      { cookie: sellerCookie() },
      {
        name: 'My Shop',
        bio: 'A helpful shop',
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
        category: 'clothing',
        sellerId: SELLER_B,
      }
    );

    expect(response.statusCode).toBe(201);
    expect(shopCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sellerId: SELLER_A }),
      })
    );
    expect(JSON.parse(response.body).shop).not.toHaveProperty('sellerId');
  });

  it('rejects duplicate shop creation for the authenticated seller', async () => {
    sellerFindUnique.mockResolvedValue(sellerProfile as never);
    shopFindUnique.mockResolvedValue({ id: 'existing-shop' } as never);

    const response = await send(
      'POST',
      '/api/create-shop',
      { cookie: sellerCookie() },
      {
        name: 'Another Shop',
        bio: 'A helpful shop',
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
        category: 'clothing',
      }
    );

    expect(response.statusCode).toBe(409);
    expect(shopCreate).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate-shop database conflict to a safe response', async () => {
    sellerFindUnique.mockResolvedValue(sellerProfile as never);
    shopFindUnique.mockResolvedValue(null);
    shopCreate.mockRejectedValue({ code: 'P2002' });

    const response = await send(
      'POST',
      '/api/create-shop',
      { cookie: sellerCookie() },
      {
        name: 'My Shop',
        bio: 'A helpful shop',
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
        category: 'clothing',
      }
    );

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      status: 'error',
      message: 'This seller already has a shop.',
    });
  });

  it('validates shop fields before creating or looking up a shop', async () => {
    sellerFindUnique.mockResolvedValue(sellerProfile as never);

    const response = await send(
      'POST',
      '/api/create-shop',
      { cookie: sellerCookie() },
      {
        name: 'X',
        bio: 'A helpful shop',
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
        category: 'clothing',
      }
    );

    expect(response.statusCode).toBe(400);
    expect(shopFindUnique).not.toHaveBeenCalled();
    expect(shopCreate).not.toHaveBeenCalled();
  });

  it('returns the authenticated seller and only that seller-owned shop', async () => {
    const profile = {
      ...sellerProfile,
      shop: {
        id: '507f1f77bcf86cd799439099',
        name: 'My Shop',
        bio: 'A helpful shop',
        category: 'clothing',
        website: null,
        address: '1 Market Street',
        opening_hours: 'Mon-Fri 9-5',
      },
    };
    sellerFindUnique
      .mockResolvedValueOnce(sellerProfile as never)
      .mockResolvedValueOnce(profile as never);

    const response = await send(
      'GET',
      '/api/logged-in-seller?sellerId=' + SELLER_B,
      { cookie: sellerCookie() }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).seller).toEqual(profile);
    expect(sellerFindUnique).toHaveBeenLastCalledWith({
      where: { id: SELLER_A },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        country: true,
        shop: {
          select: {
            id: true,
            name: true,
            bio: true,
            category: true,
            website: true,
            address: true,
            opening_hours: true,
          },
        },
      },
    });
    expect(response.body).not.toContain('password');
  });

  it('refreshes only the seller access cookie using a valid seller refresh token', async () => {
    sellerFindUnique.mockResolvedValue({ id: SELLER_A } as never);

    const response = await send('POST', '/api/refresh-seller-token', {
      origin: 'http://localhost:3000',
      cookie: `seller-refresh-token=${refreshTokenFor()}`,
    });
    const cookies = response.headers['set-cookie'] as string[];

    expect(response.statusCode).toBe(200);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain('seller-access-token=');
    expect(cookies[0]).toContain('Max-Age=900');
  });
});
