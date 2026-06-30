module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }],
    // Transform ESM JS from workspace packages (symlinked directly into node_modules)
    '^.+\\.js$': ['ts-jest', { diagnostics: false }],
  },
  // Default ignores node_modules; we must allow workspace packages through
  transformIgnorePatterns: [
    '/node_modules/.pnpm/',
  ],
  moduleNameMapper: {
    // Strip .js extensions so ts-jest can resolve TypeScript sources
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  resolver: require.resolve('./jest-resolver.cjs'),
  setupFilesAfterEnv: ['<rootDir>/src/setup.ts'],
  clearMocks: true,
};
