jest.mock('Packages/libs/redis', () => ({
  __esModule: true,
  default: {
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));
