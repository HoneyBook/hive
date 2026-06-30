module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
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
