import express from 'express';
import jwt from 'jsonwebtoken';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import prisma from '@packages/libs/prisma/index.js';
import redis from 'Packages/libs/redis/index.js';
import { createApp } from '../../product-service/src/app';

jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    products: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    images: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    sellers: { findUnique: jest.fn() },
    shops: { findUnique: jest.fn() },
    discount_codes: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('Packages/libs/redis/index.js', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const ACCESS_SECRET = 'product-service-e2e-only-secret';
const SELLER_A = '507f1f77bcf86cd799439011';
const SELLER_B = '607f1f77bcf86cd799439012';
const SHOP_A = '507f1f77bcf86cd799439021';
const SHOP_B = '607f1f77bcf86cd799439022';
const PRODUCT_ID = '507f1f77bcf86cd799439031';
const DISCOUNT_ID = '507f1f77bcf86cd799439041';
const sellers = new Map([
  [SELLER_A, { id: SELLER_A, name: 'Seller A', email: 'a@example.test', phone_number: '+1 555 0001', country: 'US' }],
  [SELLER_B, { id: SELLER_B, name: 'Seller B', email: 'b@example.test', phone_number: '+1 555 0002', country: 'US' }],
]);
const shops = new Map([
  [SELLER_A, SHOP_A],
  [SELLER_B, SHOP_B],
]);
const products = new Map<string, Record<string, any>>();
const discounts = new Map<string, Record<string, any>>();
let nextProductId = 0;
let nextDiscountId = 0;

type HttpResponse = {
  statusCode: number;
  body: string;
};

const tokenFor = (sellerId: string) =>
  jwt.sign(
    { id: sellerId, jti: `product-session-${sellerId}`, role: 'seller', tokenUse: 'access' },
    ACCESS_SECRET,
    { expiresIn: '5m' }
  );

const send = (
  port: number,
  path: string,
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  sellerId?: string,
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
          ...(sellerId
            ? { cookie: `seller-access-token=${tokenFor(sellerId)}` }
            : {}),
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (responseBody += chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: responseBody })
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

describe('product service seller workflows over HTTP', () => {
  let server: Server;
  let port: number;

  const sellerFindUnique = jest.mocked(prisma.sellers.findUnique);
  const shopFindUnique = jest.mocked(prisma.shops.findUnique);
  const productCreate = jest.mocked(prisma.products.create);
  const productFindUnique = jest.mocked(prisma.products.findUnique);
  const productFindMany = jest.mocked(prisma.products.findMany);
  const productFindFirst = jest.mocked(prisma.products.findFirst);
  const productUpdateMany = jest.mocked(prisma.products.updateMany);
  const discountCount = jest.mocked(prisma.discount_codes.count);
  const discountFindUnique = jest.mocked(prisma.discount_codes.findUnique);
  const discountCreate = jest.mocked(prisma.discount_codes.create);
  const discountFindMany = jest.mocked(prisma.discount_codes.findMany);
  const discountFindFirst = jest.mocked(prisma.discount_codes.findFirst);
  const discountDelete = jest.mocked(prisma.discount_codes.delete);
  const redisGet = jest.mocked(redis.get);

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Product service did not bind to an ephemeral port.');
    }
    port = (address as AddressInfo).port;
  });

  afterAll(async () => close(server));

  beforeEach(() => {
    jest.clearAllMocks();
    redisGet.mockImplementation(async (key) => {
      const match = /product-session-(.+)$/.exec(key);
      return match?.[1] ?? null;
    });
    products.clear();
    discounts.clear();
    nextProductId = 0;
    nextDiscountId = 0;

    sellerFindUnique.mockImplementation(async ({ where }) => sellers.get(where.id) as never ?? null);
    shopFindUnique.mockImplementation(async ({ where }) => {
      const id = shops.get(where.sellerId);
      return id ? ({ id } as never) : null;
    });
    productFindUnique.mockImplementation(async ({ where }) => {
      const product = [...products.values()].find((item) => item.slug === where.slug);
      return product ? ({ id: product.id } as never) : null;
    });
    productCreate.mockImplementation(async ({ data }) => {
      nextProductId += 1;
      const product = {
        id: PRODUCT_ID.slice(0, -1) + String(nextProductId),
        ...data,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        images: [],
      };
      products.set(product.id, product);
      return product as never;
    });
    productFindMany.mockImplementation(async ({ where }) =>
      [...products.values()].filter((item) => item.shopId === where.shopId) as never
    );
    productFindFirst.mockImplementation(async ({ where }) => {
      const product = products.get(where.id);
      return product && product.shopId === where.shopId ? product as never : null;
    });
    productUpdateMany.mockImplementation(async ({ where, data }) => {
      const product = products.get(where.id);
      if (!product || product.shopId !== where.shopId || product.isDeleted !== where.isDeleted) {
        return { count: 0 } as never;
      }
      Object.assign(product, data);
      return { count: 1 } as never;
    });
    discountCount.mockImplementation(async ({ where }) =>
      [...discounts.values()].filter((item) => item.sellerId === where.sellerId).length as never
    );
    discountFindUnique.mockImplementation(async ({ where }) => {
      const discount = [...discounts.values()].find((item) => item.discountCode === where.discountCode);
      return discount ? ({ id: discount.id } as never) : null;
    });
    discountCreate.mockImplementation(async ({ data }) => {
      nextDiscountId += 1;
      const discount = { id: DISCOUNT_ID.slice(0, -1) + String(nextDiscountId), ...data, createdAt: new Date() };
      discounts.set(discount.id, discount);
      return discount as never;
    });
    discountFindMany.mockImplementation(async ({ where }) =>
      [...discounts.values()].filter((item) => item.sellerId === where.sellerId) as never
    );
    discountFindFirst.mockImplementation(async ({ where }) => {
      const discount = discounts.get(where.id);
      return discount && discount.sellerId === where.sellerId ? ({ id: discount.id } as never) : null;
    });
    discountDelete.mockImplementation(async ({ where }) => {
      discounts.delete(where.id);
      return {} as never;
    });
  });

  it('requires seller authentication and isolates product lifecycle operations by seller', async () => {
    const anonymous = await send(port, '/api/get-shop-products', 'GET');
    expect(anonymous.statusCode).toBe(401);

    const created = await send(port, '/api/create-product', 'POST', SELLER_A, {
      title: 'Canvas Daypack',
      slug: 'canvas-daypack',
      category: 'Bags',
      subcategory: 'Backpacks',
      short_description: 'A compact everyday bag.',
      detailed_description: 'A durable canvas bag for daily use.',
      stock: 8,
      sale_price: 45,
      regular_price: 55,
    });
    expect(created.statusCode).toBe(201);
    const productId = JSON.parse(created.body).product.id as string;

    const sellerAList = await send(port, '/api/get-shop-products', 'GET', SELLER_A);
    const sellerBList = await send(port, '/api/get-shop-products', 'GET', SELLER_B);
    expect(JSON.parse(sellerAList.body).products).toHaveLength(1);
    expect(JSON.parse(sellerBList.body).products).toHaveLength(0);

    const crossSellerDelete = await send(
      port,
      `/api/delete-product/${productId}`,
      'DELETE',
      SELLER_B
    );
    expect(crossSellerDelete.statusCode).toBe(404);

    const deleted = await send(
      port,
      `/api/delete-product/${productId}`,
      'DELETE',
      SELLER_A
    );
    expect(deleted.statusCode).toBe(200);
    expect(JSON.parse(deleted.body).product.isDeleted).toBe(true);

    const restored = await send(
      port,
      `/api/restore-product/${productId}`,
      'PUT',
      SELLER_A
    );
    expect(restored.statusCode).toBe(200);
    expect(JSON.parse(restored.body).product.isDeleted).toBe(false);
  });

  it('creates, lists, and deletes only the authenticated seller discount codes', async () => {
    const created = await send(port, '/api/create-discount-code', 'POST', SELLER_A, {
      public_name: 'Spring offer',
      discountType: 'percentage',
      discountValue: 15,
      discountCode: 'spring15',
    });
    expect(created.statusCode).toBe(201);
    const discountId = JSON.parse(created.body).discount_code.id as string;

    const [sellerAList, sellerBList] = await Promise.all([
      send(port, '/api/get-discount-codes', 'GET', SELLER_A),
      send(port, '/api/get-discount-codes', 'GET', SELLER_B),
    ]);
    expect(JSON.parse(sellerAList.body).discount_codes).toHaveLength(1);
    expect(JSON.parse(sellerBList.body).discount_codes).toHaveLength(0);

    const crossSellerDelete = await send(
      port,
      `/api/delete-discount-code/${discountId}`,
      'DELETE',
      SELLER_B
    );
    expect(crossSellerDelete.statusCode).toBe(404);

    const deleted = await send(
      port,
      `/api/delete-discount-code/${discountId}`,
      'DELETE',
      SELLER_A
    );
    expect(deleted.statusCode).toBe(200);
  });
});
