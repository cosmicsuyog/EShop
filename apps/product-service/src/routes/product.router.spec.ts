import { request, type Server } from 'node:http';
import prisma from '@packages/libs/prisma/index.js';
import { createApp } from '../app.js';

describe('product catalog routes', () => {
  let server: Server;
  let port: number;
  const findMany = jest.mocked(prisma.products.findMany);
  const findFirst = jest.mocked(prisma.products.findFirst);

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
    findMany.mockReset();
    findFirst.mockReset();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
  });

  const getProducts = (path = '/api/products') =>
    new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          path,
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

  it('returns the active catalog products', async () => {
    const product = {
      id: '507f1f77bcf86cd799439011',
      title: 'Canvas Backpack',
      slug: 'canvas-backpack',
      category: 'Accessories',
      subcategory: 'Bags',
      short_description: 'A durable everyday backpack.',
      detailed_description: 'A durable backpack with multiple compartments.',
      video_url: null,
      tags: ['travel'],
      brand: 'EShop',
      colors: ['black'],
      sizes: ['one-size'],
      stock: 12,
      sale_price: 49.99,
      regular_price: 59.99,
      rattings: 4.5,
      warranty: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    findMany.mockResolvedValue([product] as never);

    const response = await getProducts('/api/products?category=Accessories');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Products fetched successfully!',
      products: [product],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          status: 'Active',
          category: 'Accessories',
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('returns an empty list when the catalog has no products', async () => {
    findMany.mockResolvedValue([]);

    const response = await getProducts();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).products).toEqual([]);
  });

  it('returns a validation error for an invalid category filter', async () => {
    const response = await getProducts('/api/products?category=');

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      status: 'error',
      message: expect.stringContaining('Category must be'),
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('forwards database errors to the error middleware', async () => {
    findMany.mockRejectedValue(new Error('database unavailable'));

    const response = await getProducts();

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Something wen wrong,please try again!',
    });
  });

  it('returns an active product by slug', async () => {
    const product = {
      id: '507f1f77bcf86cd799439011',
      title: 'Canvas Backpack',
      slug: 'canvas-backpack',
      category: 'Accessories',
      subcategory: 'Bags',
      short_description: 'A durable everyday backpack.',
      detailed_description: 'A durable backpack with multiple compartments.',
      video_url: null,
      tags: ['travel'],
      brand: 'EShop',
      colors: ['black'],
      sizes: ['one-size'],
      stock: 12,
      sale_price: 49.99,
      regular_price: 59.99,
      rattings: 4.5,
      warranty: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    findFirst.mockResolvedValue(product as never);

    const response = await getProducts('/api/products/canvas-backpack');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Product fetched successfully!',
      product,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'canvas-backpack',
          isDeleted: false,
          status: 'Active',
        },
      })
    );
  });

  it('returns 404 when a product slug is not in the active catalog', async () => {
    findFirst.mockResolvedValue(null);

    const response = await getProducts('/api/products/missing-product');

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      status: 'error',
      message: 'Product not found.',
    });
  });

  it('rejects invalid product slugs before querying the database', async () => {
    const response = await getProducts('/api/products/Invalid%20Slug');

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain(
      'Product slug must contain'
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('forwards product lookup errors to the error middleware', async () => {
    findFirst.mockRejectedValue(new Error('database unavailable'));

    const response = await getProducts('/api/products/canvas-backpack');

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Something wen wrong,please try again!',
    });
  });
});
