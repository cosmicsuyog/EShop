import { request, type Server } from 'node:http';
import prisma from '@packages/libs/prisma/index.js';
import { createApp } from '../app.js';

describe('product catalog routes', () => {
  let server: Server;
  let port: number;
  const findMany = jest.mocked(prisma.products.findMany);
  const findFirst = jest.mocked(prisma.products.findFirst);
  const count = jest.mocked(prisma.products.count);

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
    count.mockReset();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    count.mockReset();
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

  it('returns distinct active catalog categories in alphabetical order', async () => {
    findMany.mockResolvedValue([
      { category: 'Accessories' },
      { category: 'Home' },
    ] as never);

    const response = await getProducts('/api/categories');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Categories fetched successfully!',
      categories: ['Accessories', 'Home'],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: 'Active',
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
      select: {
        category: true,
      },
    });
  });

  it('returns an empty category list when no active products exist', async () => {
    findMany.mockResolvedValue([]);

    const response = await getProducts('/api/categories');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).categories).toEqual([]);
  });

  it('forwards category lookup errors to the error middleware', async () => {
    findMany.mockRejectedValue(new Error('database unavailable'));

    const response = await getProducts('/api/categories');

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Something wen wrong,please try again!',
    });
  });

  it('returns distinct active subcategories for a category', async () => {
    findMany.mockResolvedValue([
      { subcategory: 'Backpacks' },
      { subcategory: 'Totes' },
    ] as never);

    const response = await getProducts(
      '/api/subcategories?category=Accessories'
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Subcategories fetched successfully!',
      subcategories: ['Backpacks', 'Totes'],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: 'Active',
        category: 'Accessories',
      },
      distinct: ['subcategory'],
      orderBy: {
        subcategory: 'asc',
      },
      select: {
        subcategory: true,
      },
    });
  });

  it('returns an empty subcategory list when a category has no active products', async () => {
    findMany.mockResolvedValue([]);

    const response = await getProducts(
      '/api/subcategories?category=Accessories'
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).subcategories).toEqual([]);
  });

  it.each([
    ['/api/subcategories', 'missing category'],
    ['/api/subcategories?category=', 'empty category'],
    [
      '/api/subcategories?category=Accessories&category=Home',
      'repeated category',
    ],
  ])('rejects invalid subcategory lookup input (%s)', async (path) => {
    const response = await getProducts(path);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Category must be');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('forwards subcategory lookup errors to the error middleware', async () => {
    findMany.mockRejectedValue(new Error('database unavailable'));

    const response = await getProducts(
      '/api/subcategories?category=Accessories'
    );

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Something wen wrong,please try again!',
    });
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
      images: [
        { url: 'https://images.example.com/backpack-front.jpg' },
        { url: 'https://images.example.com/backpack-side.jpg' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    findMany.mockResolvedValue([product] as never);
    count.mockResolvedValue(1);

    const response = await getProducts('/api/products?category=Accessories');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Products fetched successfully!',
      products: [product],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          status: 'Active',
          category: 'Accessories',
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
        select: expect.objectContaining({
          images: {
            select: {
              url: true,
            },
          },
        }),
      })
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: 'Active',
        category: 'Accessories',
      },
    });
  });

  it('returns an empty image list for products without associated images', async () => {
    findMany.mockResolvedValue([
      {
        id: '507f1f77bcf86cd799439011',
        title: 'Canvas Backpack',
        slug: 'canvas-backpack',
        category: 'Accessories',
        subcategory: 'Bags',
        short_description: 'A durable everyday backpack.',
        detailed_description: 'A durable backpack with multiple compartments.',
        video_url: null,
        tags: [],
        brand: null,
        colors: [],
        sizes: [],
        stock: 12,
        sale_price: 49.99,
        regular_price: 59.99,
        rattings: 0,
        warranty: null,
        images: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never);
    count.mockResolvedValue(1);

    const response = await getProducts();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).products[0].images).toEqual([]);
  });

  it('omits invalid image records from catalog responses', async () => {
    findMany.mockResolvedValue([
      {
        id: '507f1f77bcf86cd799439011',
        title: 'Canvas Backpack',
        slug: 'canvas-backpack',
        category: 'Accessories',
        subcategory: 'Bags',
        short_description: 'A durable everyday backpack.',
        detailed_description: 'A durable backpack with multiple compartments.',
        video_url: null,
        tags: [],
        brand: null,
        colors: [],
        sizes: [],
        stock: 12,
        sale_price: 49.99,
        regular_price: 59.99,
        rattings: 0,
        warranty: null,
        images: [
          { url: 'javascript:alert(1)' },
          { url: '' },
          { url: 'https://images.example.com/backpack.jpg' },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never);
    count.mockResolvedValue(1);

    const response = await getProducts();

    expect(JSON.parse(response.body).products[0].images).toEqual([
      { url: 'https://images.example.com/backpack.jpg' },
    ]);
  });

  it('returns an empty list when the catalog has no products', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const response = await getProducts();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).products).toEqual([]);
    expect(JSON.parse(response.body).pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('returns the requested catalog page and total count', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(12);

    const response = await getProducts(
      '/api/products?category=Accessories&page=2&limit=5'
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).pagination).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          isDeleted: false,
          status: 'Active',
          category: 'Accessories',
        },
      })
    );
  });

  it('filters catalog results by subcategory', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const response = await getProducts(
      '/api/products?category=Accessories&subcategory=Bags'
    );

    expect(response.statusCode).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          status: 'Active',
          category: 'Accessories',
          subcategory: 'Bags',
        },
      })
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: 'Active',
        category: 'Accessories',
        subcategory: 'Bags',
      },
    });
  });

  it.each([
    ['/api/products?page=0', 'page=0'],
    ['/api/products?page=1.5', 'fractional page'],
    ['/api/products?limit=101', 'limit above the maximum'],
    ['/api/products?page=1&page=2', 'repeated page parameter'],
    ['/api/products?limit=9007199254740992', 'unsafe integer'],
  ])('rejects invalid pagination input (%s)', async (path) => {
    const response = await getProducts(path);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Page must be');
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
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

  it('returns a validation error for an invalid subcategory filter', async () => {
    const response = await getProducts('/api/products?subcategory=');

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      status: 'error',
      message: expect.stringContaining('Subcategory must be'),
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
      images: [
        { url: 'https://images.example.com/backpack-front.jpg' },
        { url: 'https://images.example.com/backpack-side.jpg' },
      ],
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
        select: expect.objectContaining({
          id: false,
          slug: true,
          detailed_description: true,
          images: {
            select: {
              url: true,
            },
          },
        }),
      })
    );
  });

  it.each([
    ['missing', 'missing-product'],
    ['inactive', 'inactive-product'],
    ['deleted', 'deleted-product'],
  ])(
    'returns 404 when the %s product is unavailable',
    async (_reason, slug) => {
      findFirst.mockResolvedValue(null);

      const response = await getProducts(`/api/products/${slug}`);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        status: 'error',
        message: 'Product not found.',
      });
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug,
            isDeleted: false,
            status: 'Active',
          },
        })
      );
    }
  );

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
