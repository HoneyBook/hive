// Why both moduleNameMapper and a custom resolver?
// The custom resolver intercepts TypeScript paths at jest's resolve step and redirects
// real modules to their .mock.ts counterparts. moduleNameMapper runs before resolution
// and strips .js extensions so that ESM workspace packages (which emit .js imports)
// resolve back to their TypeScript sources — without it, ts-jest never sees the .ts
// files and the resolver has nothing to redirect.
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
  setupFilesAfterEnv: ['@honeybook/hive-mock-adapter-jest/setup'],
  clearMocks: true,
};
