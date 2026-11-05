import cookieParser from 'cookie-parser';
import express from 'express';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import prisma from '@packages/libs/prisma/index.js';
import redis from 'Packages/libs/redis';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import { stripeService } from '../../../auth-service/src/services/stripe.service';
import router from '../../../auth-service/src/routes/auth.router';

jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    sellers: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    shops: { findUnique: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('Packages/libs/redis', () => ({
  __esModule: true,
  default: { eval: jest.fn(), get: jest.fn(), set: jest.fn() },
}));
jest.mock('../../../auth-service/src/utils/auth.helper', () => ({
  checkOtpRestrictions: jest.fn(),
  consumePasswordResetGrant: jest.fn(),
  getPasswordResetGrantUserId: jest.fn(),
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  handleForgotPassword: jest.fn(),
  sendOtp: jest.fn(),
  trackOtpRequests: jest.fn(),
  validationRegistrationData: jest.fn(),
  verifyForgotPasswordOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));
jest.mock('../../../auth-service/src/services/stripe.service', () => ({
  __esModule: true,
  stripeService: {
    createAccountLink: jest.fn(),
    createDashboardLoginLink: jest.fn(),
    getAccountStatus: jest.fn(),
    processWebhookEvent: jest.fn(),
    verifyWebhookSignature: jest.fn(),
  },
}));
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('hashed-password'),
  },
}));

const USER_ID = '507f1f77bcf86cd799439011';
const SELLER_ID = '607f1f77bcf86cd799439012';
const SHOP_ID = '607f1f77bcf86cd799439022';
const users = new Map<string, Record<string, unknown>>();
const sellers = new Map<string, Record<string, unknown>>();
const shops = new Map<string, Record<string, unknown>>();
const sessions = new Map<string, string>();
type ResponseData = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const send = (port: number, path: string, method: 'GET' | 'POST', headers = {}, body?: unknown) =>
  new Promise<ResponseData>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (responseBody += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: responseBody }));
    });
    req.on('error', reject);
    req.end(payload);
  });

const cookie = (headers: ResponseData['headers'], name: string) => {
  const value = headers['set-cookie'];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.find((item) => item.startsWith(`${name}=`))?.match(new RegExp(`^${name}=([^;]+)`))?.[1];
};

describe('customer auth session lifecycle over HTTP', () => {
  let server: Server;
  let port: number;
  const findUnique = jest.mocked(prisma.users.findUnique);
  const userCreate = jest.mocked(prisma.users.create);
  const userUpdate = jest.mocked(prisma.users.update);
  const redisGet = jest.mocked(redis.get);
  const redisSet = jest.mocked(redis.set);
  const redisEval = jest.mocked(redis.eval);
  const sellerFindUnique = jest.mocked(prisma.sellers.findUnique);
  const sellerCreate = jest.mocked(prisma.sellers.create);
  const sellerUpdate = jest.mocked(prisma.sellers.update);
  const shopFindUnique = jest.mocked(prisma.shops.findUnique);
  const shopCreate = jest.mocked(prisma.shops.create);
  const stripeApi = jest.mocked(stripeService);

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = 'auth-e2e-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'auth-e2e-refresh-secret';
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', router);
    app.use(errorMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Auth service did not bind to an ephemeral port.');
    port = (address as AddressInfo).port;
  });

  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  beforeEach(() => {
    jest.clearAllMocks();
    users.clear();
    sellers.clear();
    shops.clear();
    sessions.clear();
    findUnique.mockImplementation(async ({ where }) => {
      const user = where.id ? users.get(where.id) : [...users.values()].find((item) => item.email === where.email);
      return (user ?? null) as never;
    });
    userCreate.mockImplementation(async ({ data }) => {
      const user = { id: USER_ID, ...data, sessionVersion: 0 };
      users.set(USER_ID, user);
      return user as never;
    });
    userUpdate.mockImplementation(async ({ where, data }) => {
      const user = users.get(where.id);
      if (!user) return null as never;
      Object.assign(user, data);
      if (data.sessionVersion?.increment) user.sessionVersion = Number(user.sessionVersion) + data.sessionVersion.increment;
      return user as never;
    });
    sellerFindUnique.mockImplementation(async ({ where }) => {
      const seller = where.id
        ? sellers.get(where.id)
        : [...sellers.values()].find((item) => item.email === where.email);
      return (seller ?? null) as never;
    });
    sellerCreate.mockImplementation(async ({ data }) => {
      const seller = { id: SELLER_ID, ...data, stripeId: null };
      sellers.set(SELLER_ID, seller);
      return seller as never;
    });
    sellerUpdate.mockImplementation(async ({ where, data }) => {
      const seller = sellers.get(where.id);
      if (!seller) return null as never;
      Object.assign(seller, data);
      return seller as never;
    });
    shopFindUnique.mockImplementation(async ({ where }) => (shops.get(where.sellerId) ?? null) as never);
    shopCreate.mockImplementation(async ({ data }) => {
      const shop = { id: SHOP_ID, ...data };
      shops.set(String(data.sellerId), shop);
      return shop as never;
    });
    stripeApi.createAccountLink.mockResolvedValue({
      url: 'https://connect.stripe.test/onboarding',
      data: {
        object: 'account_link',
        created: 1_800_000_000,
        expires_at: 1_800_003_600,
        url: 'https://connect.stripe.test/onboarding',
      },
    });
    redisSet.mockImplementation(async (key, value) => {
      sessions.set(String(key).replace(/^(user|seller)_refresh_session:/, ''), String(value));
      return 'OK' as never;
    });
    redisGet.mockImplementation(async (key) => sessions.get(String(key).replace(/^(user|seller)_refresh_session:/, '')) ?? null);
    redisEval.mockImplementation(async (_script, numberOfKeys, ...args) => {
      const count = Number(numberOfKeys);
      const oldJti = String(args[0]).replace(/^(user|seller)_refresh_session:/, '');
      const id = String(args[count === 2 ? 2 : 1]);
      if (sessions.get(oldJti) !== id) return 0 as never;
      sessions.delete(oldJti);
      if (count === 2) sessions.set(String(args[1]).replace(/^(user|seller)_refresh_session:/, ''), id);
      return 1 as never;
    });
  });

  it('rotates refresh cookies and revokes old access and refresh tokens', async () => {
    users.set(USER_ID, { id: USER_ID, email: 'customer@example.test', name: 'Customer', password: 'hash', sessionVersion: 0 });
    const login = await send(port, '/api/login-user', 'POST', {}, { email: 'customer@example.test', password: 'valid-password' });
    expect(login.statusCode).toBe(200);
    const access = cookie(login.headers, 'accessToken');
    const refresh = cookie(login.headers, 'refreshToken');

    expect((await send(port, '/api/auth/logged-in-user', 'GET', { cookie: `accessToken=${access}` })).statusCode).toBe(200);

    const rotated = await send(port, '/api/auth/refresh-token', 'POST', {
      origin: 'http://localhost:3000',
      cookie: `refreshToken=${refresh}`,
    });
    expect(rotated.statusCode).toBe(200);
    const nextAccess = cookie(rotated.headers, 'accessToken');
    const nextRefresh = cookie(rotated.headers, 'refreshToken');
    expect(nextAccess).toBeDefined();
    expect(nextRefresh).toBeDefined();

    expect((await send(port, '/api/auth/refresh-token', 'POST', {
      origin: 'http://localhost:3000',
      cookie: `refreshToken=${refresh}`,
    })).statusCode).toBe(401);
    expect((await send(port, '/api/auth/logged-in-user', 'GET', { cookie: `accessToken=${access}` })).statusCode).toBe(401);

    const logout = await send(port, '/api/auth/logout-user', 'POST', {
      origin: 'http://localhost:3000',
      cookie: `refreshToken=${nextRefresh}`,
    });
    expect(logout.statusCode).toBe(200);
    expect((await send(port, '/api/auth/logged-in-user', 'GET', { cookie: `accessToken=${nextAccess}` })).statusCode).toBe(401);
    expect(redisSet).toHaveBeenCalled();
    expect(redisEval).toHaveBeenCalled();
  });

  it('registers a seller, creates an owned shop, and returns a safe mocked Stripe onboarding link', async () => {
    const registration = {
      name: 'Market Seller',
      email: 'seller@example.test',
      password: 'Seller-password-123',
      phone_number: '+1 555 0101',
      country: 'US',
    };
    expect((await send(port, '/api/seller-registration', 'POST', {}, registration)).statusCode).toBe(200);

    const verified = await send(port, '/api/verify-seller', 'POST', {}, {
      ...registration,
      otp: '123456',
    });
    expect(verified.statusCode).toBe(201);
    expect(JSON.parse(verified.body).seller.id).toBe(SELLER_ID);
    const access = cookie(verified.headers, 'seller-access-token');
    expect(access).toBeDefined();

    const shop = await send(port, '/api/create-shop', 'POST', {
      cookie: `seller-access-token=${access}`,
    }, {
      name: 'Market Seller Shop',
      bio: 'Hand-picked goods for every day.',
      category: 'Accessories',
      address: '10 Market Street',
      opening_hours: 'Monday to Saturday',
      website: 'https://seller.example.test',
    });
    expect(shop.statusCode).toBe(201);
    expect(JSON.parse(shop.body).shop.id).toBe(SHOP_ID);

    const onboarding = await send(port, '/api/create-stripe-link', 'POST', {
      cookie: `seller-access-token=${access}`,
    }, {
      refresh_url: 'http://localhost:3001/dashboard/payments?status=refresh',
      return_url: 'http://localhost:3001/dashboard/payments?status=success',
    });
    expect(onboarding.statusCode).toBe(201);
    expect(JSON.parse(onboarding.body).url).toBe('https://connect.stripe.test/onboarding');
    expect(stripeApi.createAccountLink).toHaveBeenCalledWith(SELLER_ID, {
      refresh_url: 'http://localhost:3001/dashboard/payments?status=refresh',
      return_url: 'http://localhost:3001/dashboard/payments?status=success',
    });

    const forgedSeller = await send(port, '/api/create-stripe-link', 'POST', {
      cookie: `seller-access-token=${access}`,
    }, { sellerId: USER_ID });
    expect(forgedSeller.statusCode).toBe(401);
    expect(stripeApi.createAccountLink).toHaveBeenCalledTimes(1);

    const refresh = cookie(verified.headers, 'seller-refresh-token');
    const logout = await send(port, '/api/logout-seller', 'POST', {
      origin: 'http://localhost:3001',
      cookie: `seller-refresh-token=${refresh}`,
    });
    expect(logout.statusCode).toBe(200);
    expect((await send(port, '/api/logged-in-seller', 'GET', {
      cookie: `seller-access-token=${access}`,
    })).statusCode).toBe(401);
  });
});
