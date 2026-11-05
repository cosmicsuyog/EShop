jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    products: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    images: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    sellers: {
      findUnique: jest.fn(),
    },
    shops: {
      findUnique: jest.fn(),
    },
    discount_codes: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('Packages/libs/redis/index.js', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
