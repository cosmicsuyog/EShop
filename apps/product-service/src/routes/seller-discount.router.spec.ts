import { request, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import prisma from '@packages/libs/prisma/index.js';
import { createApp } from '../app.js';

describe('seller discount code routes', () => {
  let server: Server;
  let port: number;
  const findSeller = jest.mocked(prisma.sellers.findUnique);
  const findShop = jest.mocked(prisma.shops.findUnique);
  const findDiscount = jest.mocked(prisma.discount_codes.findUnique);
  const findOwnedDiscount = jest.mocked(prisma.discount_codes.findFirst);
  const findManyDiscounts = jest.mocked(prisma.discount_codes.findMany);
  const countDiscounts = jest.mocked(prisma.discount_codes.count);
  const createDiscount = jest.mocked(prisma.discount_codes.create);
  const deleteDiscount = jest.mocked(prisma.discount_codes.delete);

  const accessTokenSecret = 'product-service-test-access-secret';
  const sellerId = '507f1f77bcf86cd799439001';
  const otherSellerId = '507f1f77bcf86cd799439002';
  const shopId = '507f1f77bcf86cd799439003';
  const discountId = '507f1f77bcf86cd799439004';

  const sellerPayload = {
    id: sellerId,
    name: 'Test Seller',
    email: 'seller@example.com',
    phone_number: '+15551234567',
    country: 'US',
  };

  const sellerToken = (id = sellerId, role: 'seller' | 'user' = 'seller') =>
    jwt.sign({ id, role, tokenUse: 'access' }, accessTokenSecret, {
      expiresIn: '1h',
    });

  const sendRequest = (
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { token?: string; body?: unknown } = {}
  ): Promise<{ statusCode: number; body: any }> =>
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
          },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve({
                statusCode: res.statusCode ?? 500,
                body: data ? JSON.parse(data) : {},
              });
            } catch {
              resolve({ statusCode: res.statusCode ?? 500, body: data });
            }
          });
        }
      );

      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = accessTokenSecret;
    server = createApp().listen(0);

    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not bind to address');
    }
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findSeller.mockResolvedValue(sellerPayload as any);
    findShop.mockResolvedValue({ id: shopId } as any);
  });

  describe('POST /api/create-discount-code', () => {
    it('requires seller authentication', async () => {
      const res = await sendRequest('POST', '/api/create-discount-code', {
        body: {
          public_name: 'Summer Sale',
          discountType: 'percentage',
          discountValue: 20,
          discountCode: 'SUMMER20',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects if seller does not have an owned shop', async () => {
      findShop.mockResolvedValueOnce(null);

      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Summer Sale',
          discountType: 'percentage',
          discountValue: 20,
          discountCode: 'SUMMER20',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('Create your shop before managing discount codes.');
    });

    it('rejects invalid percentage values outside 1-100', async () => {
      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Too High',
          discountType: 'percentage',
          discountValue: 120,
          discountCode: 'TOOHIGH',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Percentage discount value must be between 1 and 100.');
    });

    it('rejects flat discount values below the reference minimum of 1', async () => {
      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Small Discount',
          discountType: 'flat',
          discountValue: 0.5,
          discountCode: 'SMALL50',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Discount value must be at least 1.');
    });

    it('rejects when seller already has 8 discount codes (reference limit)', async () => {
      countDiscounts.mockResolvedValueOnce(8);

      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Ninth Code',
          discountType: 'flat',
          discountValue: 10,
          discountCode: 'NINTH10',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('You can only create up to 8 discount codes.');
    });

    it('rejects if discount code already exists', async () => {
      countDiscounts.mockResolvedValueOnce(2);
      findDiscount.mockResolvedValueOnce({ id: 'existing-id' } as any);

      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Duplicate Code',
          discountType: 'flat',
          discountValue: 10,
          discountCode: 'DUPLICATE',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('Discount code already exists!');
    });

    it('creates a new discount code successfully', async () => {
      countDiscounts.mockResolvedValueOnce(1);
      findDiscount.mockResolvedValueOnce(null);
      createDiscount.mockResolvedValueOnce({
        id: discountId,
        public_name: 'Summer Sale 20%',
        discountType: 'percentage',
        discountValue: 20,
        discountCode: 'SUMMER20',
        createdAt: new Date(),
      } as any);

      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Summer Sale 20%',
          discountType: 'percentage',
          discountValue: 20,
          discountCode: 'SUMMER20',
          sellerId: otherSellerId,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.discount_code.discountCode).toBe('SUMMER20');
      expect(createDiscount).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId,
            discountCode: 'SUMMER20',
            discountType: 'percentage',
            discountValue: 20,
          }),
        })
      );
    });

    it('returns a conflict if a duplicate is inserted concurrently', async () => {
      countDiscounts.mockResolvedValueOnce(0);
      findDiscount.mockResolvedValueOnce(null);
      createDiscount.mockRejectedValueOnce({ code: 'P2002' });

      const res = await sendRequest('POST', '/api/create-discount-code', {
        token: sellerToken(),
        body: {
          public_name: 'Concurrent Duplicate',
          discountType: 'flat',
          discountValue: 10,
          discountCode: 'RACE10',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('Discount code already exists!');
    });
  });

  describe('GET /api/get-discount-codes', () => {
    it('requires seller authentication', async () => {
      const res = await sendRequest('GET', '/api/get-discount-codes');
      expect(res.statusCode).toBe(401);
    });

    it('returns only discounts owned by the seller', async () => {
      findManyDiscounts.mockResolvedValueOnce([
        {
          id: discountId,
          public_name: 'VIP Club',
          discountType: 'flat',
          discountValue: 15,
          discountCode: 'VIP15',
          createdAt: new Date(),
        },
      ] as any);

      const res = await sendRequest('GET', '/api/get-discount-codes', {
        token: sellerToken(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.discount_codes).toHaveLength(1);
      expect(findManyDiscounts).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId },
        })
      );
    });
  });

  describe('DELETE /api/delete-discount-code/:id', () => {
    it('requires seller authentication', async () => {
      const res = await sendRequest('DELETE', `/api/delete-discount-code/${discountId}`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for invalid ObjectId', async () => {
      const res = await sendRequest('DELETE', '/api/delete-discount-code/invalid-id', {
        token: sellerToken(),
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Discount code ID is invalid.');
    });

    it('returns 404 if discount code does not exist', async () => {
      findOwnedDiscount.mockResolvedValueOnce(null);

      const res = await sendRequest('DELETE', `/api/delete-discount-code/${discountId}`, {
        token: sellerToken(),
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Discount code not found!');
    });

    it('hides discount codes owned by another seller', async () => {
      findOwnedDiscount.mockResolvedValueOnce(null);

      const res = await sendRequest('DELETE', `/api/delete-discount-code/${discountId}`, {
        token: sellerToken(),
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Discount code not found!');
      expect(deleteDiscount).not.toHaveBeenCalled();
      expect(findOwnedDiscount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: discountId, sellerId },
        })
      );
    });

    it('deletes the discount code successfully when seller owns it', async () => {
      findOwnedDiscount.mockResolvedValueOnce({ id: discountId } as any);
      deleteDiscount.mockResolvedValueOnce({} as any);

      const res = await sendRequest('DELETE', `/api/delete-discount-code/${discountId}`, {
        token: sellerToken(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deleteDiscount).toHaveBeenCalledWith({
        where: { id: discountId },
      });
    });
  });
});
