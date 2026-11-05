import { readFileSync } from 'node:fs';

const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

swcJestConfig.swcrc = false;

export default {
  displayName: 'product-service',
  preset: '../../jest.preset.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@packages/(.*)\\.js$': '<rootDir>/../../Packages/$1',
    '^@packages/(.*)$': '<rootDir>/../../Packages/$1',
    '^Packages/(.*)$': '<rootDir>/../../Packages/$1',
    '^([.]{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
