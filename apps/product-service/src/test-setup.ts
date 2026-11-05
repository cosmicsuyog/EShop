jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    products: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    sellers: {
      findUnique: jest.fn(),
    },
    shops: {
      findUnique: jest.fn(),
    },
  },
}));
