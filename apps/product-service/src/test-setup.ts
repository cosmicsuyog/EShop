jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    products: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));
