import express from 'express';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import cookieParser from 'cookie-parser';
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
    carts: {
      upsert: jest.fn(),
    },
    cartItems: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    products: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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

const ACCESS_SECRET = 'cart-test-access-token-secret';
const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '607f1f77bcf86cd799439012';
const CART_A = '507f1f77bcf86cd799439021';
const CART_B = '607f1f77bcf86cd799439022';
const PRODUCT_ID = '507f1f77bcf86cd799439031';
const product = {
  id: PRODUCT_ID,
  title: 'Everyday Backpack',
  slug: 'everyday-backpack',
  stock: 10,
  sale_price: 25,
  status: 'Active',
  isDeleted: false,
  images: [{ url: 'https://images.example.test/backpack.jpg' }],
};

type HttpResponse = {
  statusCode: number;
  body: string;
};

const tokenFor = (userId: string) =>
  jwt.sign({ id: userId, role: 'user', tokenUse: 'access' }, ACCESS_SECRET, {
    expiresIn: '5m',
  });

describe('authenticated customer cart routes', () => {
  let server: Server;
  let port: number;
  const userFindUnique = jest.mocked(prisma.users.findUnique);
  const cartUpsert = jest.mocked(prisma.carts.upsert);
  const cartItemFindMany = jest.mocked(prisma.cartItems.findMany);
  const cartItemFindUnique = jest.mocked(prisma.cartItems.findUnique);
  const cartItemUpsert = jest.mocked(prisma.cartItems.upsert);
  const cartItemUpdate = jest.mocked(prisma.cartItems.update);
  const cartItemUpdateMany = jest.mocked(prisma.cartItems.updateMany);
  const cartItemDeleteMany = jest.mocked(prisma.cartItems.deleteMany);
  const productFindUnique = jest.mocked(prisma.products.findUnique);
  const productFindMany = jest.mocked(prisma.products.findMany);
  const originalAccessSecret = process.env.ACCESS_TOKEN_SECRET;
  const customerCarts = new Map([
    [USER_A, CART_A],
    [USER_B, CART_B],
  ]);
  const itemsByCart = new Map<
    string,
    Array<{ id: string; productId: string; quantity: number }>
  >();

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
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
      throw new Error('The cart test server did not bind to a TCP address.');
    }
    port = (address as AddressInfo).port;
  });

  afterAll(async () => {
    if (originalAccessSecret === undefined) {
      delete process.env.ACCESS_TOKEN_SECRET;
    } else {
      process.env.ACCESS_TOKEN_SECRET = originalAccessSecret;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    itemsByCart.clear();
    userFindUnique.mockImplementation(
      async ({ where }) =>
        ({
          id: where.id,
          email: 'customer@example.com',
          name: 'Customer',
        } as never)
    );
    cartUpsert.mockImplementation(
      async ({ where }) =>
        ({
          id: customerCarts.get(where.userId) ?? CART_A,
        } as never)
    );
    cartItemFindMany.mockImplementation(
      async ({ where }) => (itemsByCart.get(where.cartId) ?? []) as never
    );
    cartItemFindUnique.mockImplementation(async ({ where }) => {
      const { cartId, productId } = where.cartId_productId;
      const item = (itemsByCart.get(cartId) ?? []).find(
        (entry) => entry.productId === productId
      );
      return item ? ({ quantity: item.quantity } as never) : null;
    });
    cartItemUpsert.mockImplementation(async ({ where, create, update }) => {
      const { cartId, productId } = where.cartId_productId;
      const items = itemsByCart.get(cartId) ?? [];
      const item = items.find((entry) => entry.productId === productId);
      if (item) {
        item.quantity += update.quantity.increment;
      } else {
        items.push({
          id: '507f1f77bcf86cd799439099',
          productId: create.productId,
          quantity: create.quantity,
        });
      }
      itemsByCart.set(cartId, items);
      return {
        quantity: items.find((entry) => entry.productId === productId)
          ?.quantity,
      };
    });
    cartItemUpdate.mockImplementation(async ({ where, data }) => {
      const { cartId, productId } = where.cartId_productId;
      const item = (itemsByCart.get(cartId) ?? []).find(
        (entry) => entry.productId === productId
      );
      if (item) {
        item.quantity += data.quantity.decrement;
      }
      return { quantity: item?.quantity } as never;
    });
    cartItemUpdateMany.mockImplementation(async ({ where, data }) => {
      const item = (itemsByCart.get(where.cartId) ?? []).find(
        (entry) => entry.productId === where.productId
      );
      if (item) {
        item.quantity = data.quantity;
      }
      return { count: item ? 1 : 0 };
    });
    cartItemDeleteMany.mockImplementation(async ({ where }) => {
      const items = itemsByCart.get(where.cartId) ?? [];
      const remaining = where.productId
        ? items.filter((entry) => entry.productId !== where.productId)
        : [];
      itemsByCart.set(where.cartId, remaining);
      return { count: items.length - remaining.length };
    });
    productFindUnique.mockResolvedValue(product as never);
    productFindMany.mockImplementation(
      async ({ where }) =>
        [product].filter((entry) => where.id.in.includes(entry.id)) as never
    );
  });

  const send = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    userId?: string,
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
            ...(userId ? { authorization: `Bearer ${tokenFor(userId)}` } : {}),
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
          res.on('data', (chunk: string) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: responseBody,
            });
          });
        }
      );
      req.on('error', reject);
      req.end(payload);
    });

  it('rejects unauthenticated cart requests', async () => {
    const response = await send('GET', '/api/cart');

    expect(response.statusCode).toBe(401);
    expect(cartUpsert).not.toHaveBeenCalled();
  });

  it('retrieves only the verified customer cart and derives its totals from product data', async () => {
    itemsByCart.set(CART_A, [
      { id: 'item-a', productId: PRODUCT_ID, quantity: 2 },
    ]);

    const response = await send('GET', `/api/cart?userId=${USER_B}`, USER_A);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(cartUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_A },
      })
    );
    expect(body.cart).toMatchObject({
      itemCount: 2,
      subtotal: 50,
      items: [
        {
          productId: PRODUCT_ID,
          quantity: 2,
          available: true,
          product: {
            title: product.title,
            salePrice: product.sale_price,
          },
          lineSubtotal: 50,
        },
      ],
    });
  });

  it('adds a valid product and increments quantity on duplicate additions', async () => {
    const first = await send('POST', '/api/cart/items', USER_A, {
      productId: PRODUCT_ID,
      quantity: 2,
      userId: USER_B,
    });
    const duplicate = await send('POST', '/api/cart/items', USER_A, {
      productId: PRODUCT_ID,
      quantity: 3,
    });

    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body).cart.itemCount).toBe(2);
    expect(duplicate.statusCode).toBe(200);
    expect(JSON.parse(duplicate.body).cart.itemCount).toBe(5);
    expect(cartUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } })
    );
    expect(cartItemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cartId_productId: { cartId: CART_A, productId: PRODUCT_ID },
        },
      })
    );
  });

  it('rejects malformed, missing, and unavailable product references', async () => {
    const malformed = await send('POST', '/api/cart/items', USER_A, {
      productId: 'not-an-object-id',
      quantity: 1,
    });
    expect(malformed.statusCode).toBe(400);

    productFindUnique.mockResolvedValueOnce(null);
    const missing = await send('POST', '/api/cart/items', USER_A, {
      productId: PRODUCT_ID,
      quantity: 1,
    });
    expect(missing.statusCode).toBe(404);
    expect(JSON.parse(missing.body).message).toContain('unavailable');

    productFindUnique.mockResolvedValueOnce({
      ...product,
      status: 'Pending',
    } as never);
    const inactive = await send('POST', '/api/cart/items', USER_A, {
      productId: PRODUCT_ID,
      quantity: 1,
    });
    expect(inactive.statusCode).toBe(404);
  });

  it.each([0, -1, 1.5, '2', null])(
    'rejects invalid quantity %s',
    async (quantity) => {
      const response = await send('POST', '/api/cart/items', USER_A, {
        productId: PRODUCT_ID,
        quantity,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('positive whole');
      expect(productFindUnique).not.toHaveBeenCalled();
    }
  );

  it('rejects quantities exceeding current product stock', async () => {
    const response = await send('POST', '/api/cart/items', USER_A, {
      productId: PRODUCT_ID,
      quantity: product.stock + 1,
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain(
      'exceeds available stock'
    );
    expect(cartItemUpsert).not.toHaveBeenCalled();
  });

  it('updates item quantity using the authenticated customer cart', async () => {
    itemsByCart.set(CART_A, [
      { id: 'item-a', productId: PRODUCT_ID, quantity: 2 },
    ]);

    const response = await send(
      'PATCH',
      `/api/cart/items/${PRODUCT_ID}`,
      USER_A,
      { quantity: 4 }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).cart.itemCount).toBe(4);
    expect(cartItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cartId: CART_A, productId: PRODUCT_ID },
        data: { quantity: 4 },
      })
    );
  });

  it('rejects quantity changes for missing cart items', async () => {
    const response = await send(
      'PATCH',
      `/api/cart/items/${PRODUCT_ID}`,
      USER_A,
      { quantity: 1 }
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe('Cart item not found.');
  });

  it('removes a cart item and clears only the authenticated customer cart', async () => {
    itemsByCart.set(CART_A, [
      { id: 'item-a', productId: PRODUCT_ID, quantity: 2 },
    ]);

    const removed = await send(
      'DELETE',
      `/api/cart/items/${PRODUCT_ID}`,
      USER_A
    );
    expect(removed.statusCode).toBe(200);
    expect(JSON.parse(removed.body).cart.itemCount).toBe(0);

    itemsByCart.set(CART_A, [
      { id: 'item-a', productId: PRODUCT_ID, quantity: 2 },
    ]);
    itemsByCart.set(CART_B, [
      { id: 'item-b', productId: PRODUCT_ID, quantity: 4 },
    ]);
    const cleared = await send('DELETE', '/api/cart', USER_A);

    expect(cleared.statusCode).toBe(200);
    expect(JSON.parse(cleared.body).cart.itemCount).toBe(0);
    expect(itemsByCart.get(CART_B)).toEqual([
      { id: 'item-b', productId: PRODUCT_ID, quantity: 4 },
    ]);
  });

  it('keeps customer carts isolated', async () => {
    itemsByCart.set(CART_A, [
      { id: 'item-a', productId: PRODUCT_ID, quantity: 1 },
    ]);
    itemsByCart.set(CART_B, [
      { id: 'item-b', productId: PRODUCT_ID, quantity: 4 },
    ]);

    const [responseA, responseB] = await Promise.all([
      send('GET', '/api/cart', USER_A),
      send('GET', '/api/cart', USER_B),
    ]);

    expect(JSON.parse(responseA.body).cart.itemCount).toBe(1);
    expect(JSON.parse(responseB.body).cart.itemCount).toBe(4);
    expect(cartUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { userId: USER_A } })
    );
    expect(cartUpsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { userId: USER_B } })
    );
  });

  it('does not expose internal database error details', async () => {
    cartUpsert.mockRejectedValueOnce(
      new Error('private database connection detail')
    );

    const response = await send('GET', '/api/cart', USER_A);

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('private database connection detail');
  });
});
