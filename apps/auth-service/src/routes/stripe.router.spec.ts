import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '@packages/libs/prisma/index.js';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import router from './auth.router';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    sellers: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
    },
    shops: {
      findUnique: jest.fn(),
    },
  },
}));

const ACCESS_SECRET = 'stripe-test-access-token-secret';
const WEBHOOK_SECRET = 'whsec_test_secret_1234567890';
const STRIPE_KEY = 'sk_test_mock_stripe_key';
const SELLER_ID = '507f1f77bcf86cd799439011';
const OTHER_SELLER_ID = '607f1f77bcf86cd799439012';

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

const tokenFor = (id: string, role: 'seller' | 'user' = 'seller') =>
  jwt.sign({ id, role, tokenUse: 'access' }, ACCESS_SECRET, {
    expiresIn: '5m',
  });

describe('Stripe Connect onboarding, status, and webhook routes', () => {
  let server: Server;
  let port: number;
  const sellerFindUnique = jest.mocked(prisma.sellers.findUnique);
  const sellerUpdate = jest.mocked(prisma.sellers.update);

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', router);
    app.use(errorMiddleware);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sendRequest = (
    method: 'GET' | 'POST',
    path: string,
    options: {
      body?: unknown;
      token?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<HttpResponse> =>
    new Promise((resolve, reject) => {
      const payload =
        options.body !== undefined
          ? typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body)
          : undefined;

      const req = request(
        `http://127.0.0.1:${port}${path}`,
        {
          method,
          headers: {
            'content-type': 'application/json',
            ...(options.token
              ? { cookie: `seller-access-token=${options.token}` }
              : {}),
            ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
            ...options.headers,
          },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode ?? 500,
              headers: res.headers,
              body,
            });
          });
        }
      );

      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });

  describe('POST /api/create-stripe-link', () => {
    it('requires seller authentication', async () => {
      const response = await sendRequest('POST', '/api/create-stripe-link', {
        body: {},
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe(
        'Seller access token is required.'
      );
    });

    it('rejects client attempting to connect for a different seller ID', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        email: 'seller@example.com',
        country: 'US',
        name: 'Seller One',
        stripeId: null,
      } as any);

      const response = await sendRequest('POST', '/api/create-stripe-link', {
        token: tokenFor(SELLER_ID),
        body: { sellerId: OTHER_SELLER_ID },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe(
        'Unauthorized: Seller ID mismatch.'
      );
    });

    it('creates a new Stripe account and returns account link URL when seller has no stripeId', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        email: 'seller@example.com',
        country: 'US',
        name: 'Seller One',
        stripeId: null,
      } as any);

      mockedAxios.post.mockImplementation(async (url: string) => {
        if (url.includes('/v1/accounts')) {
          return { data: { id: 'acct_new_12345' } } as any;
        }
        if (url.includes('/v1/account_links')) {
          return {
            data: {
              object: 'account_link',
              url: 'https://connect.stripe.com/setup/s/mock_url',
              expires_at: 1700000000,
            },
          } as any;
        }
        throw new Error(`Unexpected url: ${url}`);
      });

      sellerUpdate.mockResolvedValue({} as any);

      const response = await sendRequest('POST', '/api/create-stripe-link', {
        token: tokenFor(SELLER_ID),
        body: {},
      });

      expect(response.statusCode).toBe(201);
      const parsed = JSON.parse(response.body);
      expect(parsed.success).toBe(true);
      expect(parsed.url).toBe('https://connect.stripe.com/setup/s/mock_url');
      expect(sellerUpdate).toHaveBeenCalledWith({
        where: { id: SELLER_ID },
        data: { stripeId: 'acct_new_12345' },
      });
    });

    it('reuses existing Stripe account if seller already has stripeId', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        email: 'seller@example.com',
        country: 'US',
        name: 'Seller One',
        stripeId: 'acct_existing_99999',
      } as any);

      mockedAxios.post.mockResolvedValue({
        data: {
          object: 'account_link',
          url: 'https://connect.stripe.com/setup/s/existing_url',
          expires_at: 1700000000,
        },
      } as any);

      const response = await sendRequest('POST', '/api/create-stripe-link', {
        token: tokenFor(SELLER_ID),
        body: {},
      });

      expect(response.statusCode).toBe(201);
      const parsed = JSON.parse(response.body);
      expect(parsed.url).toBe('https://connect.stripe.com/setup/s/existing_url');
      // Should NOT call accounts.create or seller.update since it already exists
      expect(sellerUpdate).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/stripe-account-status', () => {
    it('requires seller authentication', async () => {
      const response = await sendRequest('GET', '/api/stripe-account-status');
      expect(response.statusCode).toBe(401);
    });

    it('returns connected: false when seller has no stripeId', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        stripeId: null,
      } as any);

      const response = await sendRequest('GET', '/api/stripe-account-status', {
        token: tokenFor(SELLER_ID),
      });

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed.connected).toBe(false);
      expect(parsed.stripeId).toBeNull();
    });

    it('returns account details and active status from Stripe API', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        stripeId: 'acct_active_123',
      } as any);

      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'acct_active_123',
          details_submitted: true,
          payouts_enabled: true,
          charges_enabled: true,
          default_currency: 'usd',
        },
      } as any);

      const response = await sendRequest('GET', '/api/stripe-account-status', {
        token: tokenFor(SELLER_ID),
      });

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed.connected).toBe(true);
      expect(parsed.detailsSubmitted).toBe(true);
      expect(parsed.payoutsEnabled).toBe(true);
      expect(parsed.chargesEnabled).toBe(true);
      expect(parsed.currency).toBe('usd');
    });
  });

  describe('POST /api/create-stripe-dashboard-link', () => {
    it('returns 409 if seller has no Stripe account connected', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        stripeId: null,
      } as any);

      const response = await sendRequest(
        'POST',
        '/api/create-stripe-dashboard-link',
        { token: tokenFor(SELLER_ID) }
      );

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body).message).toBe(
        'Seller has not connected a Stripe account yet.'
      );
    });

    it('returns dashboard login link for connected seller', async () => {
      sellerFindUnique.mockResolvedValue({
        id: SELLER_ID,
        stripeId: 'acct_ready_456',
      } as any);

      mockedAxios.post.mockResolvedValue({
        data: {
          object: 'login_link',
          url: 'https://connect.stripe.com/express/mock_dashboard_link',
        },
      } as any);

      const response = await sendRequest(
        'POST',
        '/api/create-stripe-dashboard-link',
        { token: tokenFor(SELLER_ID) }
      );

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed.url).toBe(
        'https://connect.stripe.com/express/mock_dashboard_link'
      );
    });
  });

  describe('POST /api/stripe-webhook', () => {
    const createSignature = (payload: string, timestamp: number, secret = WEBHOOK_SECRET) => {
      const signed = `${timestamp}.${payload}`;
      const sig = crypto.createHmac('sha256', secret).update(signed).digest('hex');
      return `t=${timestamp},v1=${sig}`;
    };

    it('rejects webhooks missing stripe-signature header', async () => {
      const response = await sendRequest('POST', '/api/stripe-webhook', {
        body: { id: 'evt_123', type: 'account.updated' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe(
        'Missing stripe-signature header.'
      );
    });

    it('rejects webhooks with forged or invalid signature', async () => {
      const payload = JSON.stringify({ id: 'evt_123', type: 'account.updated' });
      const now = Math.floor(Date.now() / 1000);
      const forgedSig = createSignature(payload, now, 'wrong_secret');

      const response = await sendRequest('POST', '/api/stripe-webhook', {
        body: payload,
        headers: { 'stripe-signature': forgedSig },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe(
        'Stripe webhook signature verification failed.'
      );
    });

    it('rejects webhooks that have expired past tolerance', async () => {
      const payload = JSON.stringify({ id: 'evt_123', type: 'account.updated' });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const expiredSig = createSignature(payload, expiredTimestamp);

      const response = await sendRequest('POST', '/api/stripe-webhook', {
        body: payload,
        headers: { 'stripe-signature': expiredSig },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe(
        'Stripe webhook signature has expired.'
      );
    });

    it('successfully processes valid HMAC-SHA256 verified account.updated webhook', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_valid_123',
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_webhook_test_123',
            payouts_enabled: true,
          },
        },
      });
      const now = Math.floor(Date.now() / 1000);
      const validSig = createSignature(payload, now);

      sellerFindUnique.mockResolvedValueOnce({
        id: SELLER_ID,
        stripeId: 'acct_webhook_test_123',
      } as any);

      const response = await sendRequest('POST', '/api/stripe-webhook', {
        body: payload,
        headers: { 'stripe-signature': validSig },
      });

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed.received).toBe(true);
      expect(parsed.type).toBe('account.updated');
    });
  });
});
