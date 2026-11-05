import { request, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import prisma from '@packages/libs/prisma/index.js';
import { createApp } from '../app.js';

describe('product catalog routes', () => {
  let server: Server;
  let port: number;
  const findMany = jest.mocked(prisma.products.findMany);
  const findFirst = jest.mocked(prisma.products.findFirst);
  const findUnique = jest.mocked(prisma.products.findUnique);
  const create = jest.mocked(prisma.products.create);
  const updateMany = jest.mocked(prisma.products.updateMany);
  const count = jest.mocked(prisma.products.count);
  const findSeller = jest.mocked(prisma.sellers.findUnique);
  const findShop = jest.mocked(prisma.shops.findUnique);
  const accessTokenSecret = 'product-service-test-access-secret';

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = accessTokenSecret;
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
    findUnique.mockReset();
    create.mockReset();
    updateMany.mockReset();
    count.mockReset();
    findSeller.mockReset();
    findShop.mockReset();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
    create.mockReset();
    updateMany.mockReset();
    count.mockReset();
    findSeller.mockReset();
    findShop.mockReset();
  });

  const sendRequest = (
    method: string,
    path: string,
    body?: unknown,
    token?: string
  ) =>
    new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const requestBody = body === undefined ? undefined : JSON.stringify(body);
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...(requestBody ? { 'content-type': 'application/json' } : {}),
            ...(requestBody
              ? { 'content-length': Buffer.byteLength(requestBody) }
              : {}),
            ...(token ? { cookie: `seller-access-token=${token}` } : {}),
          },
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
      if (requestBody) {
        req.write(requestBody);
      }
      req.end();
    });

  const getProducts = (path = '/api/products') => sendRequest('GET', path);
  const sellerAccessToken = (sellerId = '507f1f77bcf86cd799439001') =>
    jwt.sign(
      { id: sellerId, role: 'seller', tokenUse: 'access' },
      accessTokenSecret,
      { expiresIn: 900 }
    );
  const authenticateSeller = (
    sellerId = '507f1f77bcf86cd799439001',
    shopId = '507f1f77bcf86cd799439002'
  ) => {
    findSeller.mockResolvedValue({
      id: sellerId,
      email: 'seller@example.com',
      name: 'Seller',
      phone_number: '+1 555 0100',
      country: 'US',
    } as never);
    findShop.mockResolvedValue({ id: shopId } as never);
    return sellerAccessToken(sellerId);
  };

  const product = {
    id: '507f1f77bcf86cd799439003',
    title: 'Canvas Backpack',
    slug: 'canvas-backpack',
    category: 'Accessories',
    subcategory: 'Bags',
    short_description: 'A durable backpack.',
    detailed_description: 'A durable everyday backpack with multiple pockets.',
    video_url: null,
    tags: ['travel'],
    brand: null,
    colors: [],
    sizes: [],
    stock: 12,
    sale_price: 49.99,
    regular_price: 59.99,
    rattings: 0,
    warranty: null,
    isDeleted: false,
    deletedAt: null,
    images: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const productInput = {
    title: product.title,
    slug: product.slug,
    category: product.category,
    subcategory: product.subcategory,
    short_description: product.short_description,
    detailed_description: product.detailed_description,
    tags: product.tags,
    stock: product.stock,
    sale_price: product.sale_price,
    regular_price: product.regular_price,
  };

  it('creates a product in the authenticated seller shop, ignoring client ownership IDs', async () => {
    const token = authenticateSeller();
    findUnique.mockResolvedValue(null as never);
    create.mockResolvedValue(product as never);

    const response = await sendRequest(
      'POST',
      '/api/create-product',
      {
        ...productInput,
        sellerId: '507f1f77bcf86cd799439099',
        shopId: '507f1f77bcf86cd799439099',
      },
      token
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).product).toMatchObject({
      id: product.id,
      slug: product.slug,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: product.title,
          shopId: '507f1f77bcf86cd799439002',
        }),
        select: expect.objectContaining({
          id: true,
          isDeleted: true,
        }),
      })
    );
    const createData = create.mock.calls[0][0]?.data as
      | Record<string, unknown>
      | undefined;
    expect(createData).not.toHaveProperty('sellerId');
    expect(createData?.shopId).not.toBe('507f1f77bcf86cd799439099');
  });

  it('rejects unauthenticated seller product requests', async () => {
    const response = await getProducts('/api/get-shop-products');

    expect(response.statusCode).toBe(401);
    expect(findSeller).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not accept a customer access token for seller product routes', async () => {
    const customerToken = jwt.sign(
      { id: '507f1f77bcf86cd799439004', role: 'user', tokenUse: 'access' },
      accessTokenSecret,
      { expiresIn: 900 }
    );

    const response = await sendRequest(
      'GET',
      '/api/get-shop-products',
      undefined,
      customerToken
    );

    expect(response.statusCode).toBe(401);
    expect(findSeller).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('lists only products from the authenticated seller shop, including deleted products', async () => {
    const token = authenticateSeller();
    findMany.mockResolvedValue([{ ...product, isDeleted: true }] as never);

    const response = await sendRequest(
      'GET',
      '/api/get-shop-products',
      undefined,
      token
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).products[0].isDeleted).toBe(true);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: '507f1f77bcf86cd799439002' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  it('soft-deletes a product using an ownership-scoped atomic update', async () => {
    const token = authenticateSeller();
    updateMany.mockResolvedValue({ count: 1 } as never);
    findFirst.mockResolvedValue({
      ...product,
      isDeleted: true,
      deletedAt: new Date(),
    } as never);

    const response = await sendRequest(
      'DELETE',
      `/api/delete-product/${product.id}`,
      undefined,
      token
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).product.isDeleted).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: product.id,
          shopId: '507f1f77bcf86cd799439002',
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      })
    );
  });

  it('restores a product using an ownership-scoped atomic update', async () => {
    const token = authenticateSeller();
    updateMany.mockResolvedValue({ count: 1 } as never);
    findFirst.mockResolvedValue({ ...product, isDeleted: false } as never);

    const response = await sendRequest(
      'PUT',
      `/api/restore-product/${product.id}`,
      undefined,
      token
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).product.isDeleted).toBe(false);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: product.id,
          shopId: '507f1f77bcf86cd799439002',
          isDeleted: true,
        },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      })
    );
  });

  it('does not expose another seller product for deletion or restoration', async () => {
    const token = authenticateSeller();
    updateMany.mockResolvedValue({ count: 0 } as never);
    findFirst.mockResolvedValue(null as never);

    for (const [method, action] of [
      ['DELETE', 'delete-product'],
      ['PUT', 'restore-product'],
    ]) {
      const response = await sendRequest(
        method,
        `/api/${action}/${product.id}`,
        undefined,
        token
      );
      expect(response.statusCode).toBe(404);
    }

    expect(updateMany).toHaveBeenCalledTimes(2);
    for (const [call] of updateMany.mock.calls) {
      expect(call?.where).toEqual(
        expect.objectContaining({ shopId: '507f1f77bcf86cd799439002' })
      );
    }
    for (const [call] of findFirst.mock.calls) {
      expect(call?.where).toEqual(
        expect.objectContaining({ shopId: '507f1f77bcf86cd799439002' })
      );
    }
  });

  it('rejects invalid IDs without querying product records', async () => {
    const token = authenticateSeller();

    const response = await sendRequest(
      'DELETE',
      '/api/delete-product/not-an-object-id',
      undefined,
      token
    );

    expect(response.statusCode).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
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

  it('searches product titles case-insensitively', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await getProducts('/api/products?q=Backpack');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              title: {
                contains: 'Backpack',
                mode: 'insensitive',
              },
            },
          ]),
        }),
      })
    );
  });

  it('searches product descriptions and brand', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await getProducts('/api/products?q=travel');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              title: {
                contains: 'travel',
                mode: 'insensitive',
              },
            },
            {
              short_description: {
                contains: 'travel',
                mode: 'insensitive',
              },
            },
            {
              detailed_description: {
                contains: 'travel',
                mode: 'insensitive',
              },
            },
            {
              brand: {
                contains: 'travel',
                mode: 'insensitive',
              },
            },
          ],
        }),
      })
    );
  });

  it('trims search terms and combines them with category filters', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await getProducts(
      '/api/products?q=%20%20backpack%20%20&category=Accessories&subcategory=Bags'
    );

    const expectedWhere = {
      isDeleted: false,
      status: 'Active',
      category: 'Accessories',
      subcategory: 'Bags',
      OR: [
        {
          title: {
            contains: 'backpack',
            mode: 'insensitive',
          },
        },
        {
          short_description: {
            contains: 'backpack',
            mode: 'insensitive',
          },
        },
        {
          detailed_description: {
            contains: 'backpack',
            mode: 'insensitive',
          },
        },
        {
          brand: {
            contains: 'backpack',
            mode: 'insensitive',
          },
        },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    );
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('ignores empty and whitespace-only search terms', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await getProducts('/api/products?q=%20%20%20');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          status: 'Active',
        },
      })
    );
  });

  it('applies search before paginating and counts only matching products', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(11);

    const response = await getProducts('/api/products?q=pack&page=2&limit=5');

    expect(JSON.parse(response.body).pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              title: {
                contains: 'pack',
                mode: 'insensitive',
              },
            },
          ]),
        }),
      })
    );
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              title: {
                contains: 'pack',
                mode: 'insensitive',
              },
            },
          ]),
        }),
      })
    );
  });

  it('returns an empty result and zero pages when a search has no matches', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const response = await getProducts('/api/products?q=missing-product');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      products: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('rejects repeated and overlong search query parameters', async () => {
    for (const path of [
      '/api/products?q=bag&q=pack',
      `/api/products?q=${'a'.repeat(101)}`,
    ]) {
      const response = await getProducts(path);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Search query');
    }

    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
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

    const response = await getProducts('/api/products?q=backpack');

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
          id: true,
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
