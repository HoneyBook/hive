module.exports = {
  testEnvironment: 'node',
  testTimeout: 120_000,
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.(ts|js)$': ['ts-jest', { diagnostics: false }] },
  transformIgnorePatterns: [
    '/node_modules/.pnpm/(?!(lodash-es|type-fest))',
    '/node_modules/(?!(.pnpm|lodash-es|type-fest))',
  ],
  moduleNameMapper: {
    '^@honeybook/hive$': '<rootDir>/../hive/index.ts',
    '^@honeybook/hive-runner$': '<rootDir>/../hive-runner/index.ts',
  },
};
