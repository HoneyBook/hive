module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  // Default testMatch treats every file under __tests__ as a suite, which
  // would sweep up the fixtures/ directory (a fake package, not test files).
  testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
  transform: { "^.+\\.(ts|js)$": ["ts-jest", { diagnostics: false }] },
  transformIgnorePatterns: [
    "/node_modules/.pnpm/(?!(lodash-es|type-fest))",
    "/node_modules/(?!(.pnpm|lodash-es|type-fest))",
  ],
  moduleNameMapper: {
    "^@honeybook/hive$": "<rootDir>/../hive/index.ts",
    // Source imports write explicit .js extensions (required for the
    // compiled ESM output to resolve under Node's own module loader) —
    // strip them back off so Jest resolves the relative specifier to its
    // .ts source file instead of a literal (nonexistent) .js file.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
