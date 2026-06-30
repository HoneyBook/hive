// CJS shim for the built-in jest resolver — published as the `./resolver` subpath export.
// This file exists because jest resolvers must be requireable (CJS); the TS implementation
// in src/mockSubstitutionResolver.ts is the ESM source, but jest.config.js (CJS) cannot
// load it directly via require.resolve. This shim duplicates only the default sibling-resolver
// behavior. For __mocks__/ support, compose resolvers in your own jest-resolver.cjs file:
//
//   const { siblingMockResolver, mocksDirResolver } = require('@honeybook/hive-mock-adapter-jest');
//   module.exports = function(request, options) {
//     const real = options.defaultResolver(request, options);
//     if (!real.endsWith('.ts') && !real.endsWith('.tsx')) return real;
//     return siblingMockResolver(real) ?? mocksDirResolver(real) ?? real;
//   };
const { existsSync } = require('node:fs');

function siblingMockResolver(realPath) {
  const match = realPath.match(/^(.*)\.(tsx?)$/);
  if (!match) return null;
  const candidate = `${match[1]}.mock.${match[2]}`;
  if (existsSync(candidate)) return candidate;
  return null;
}

module.exports = function mockSubstitutionResolver(request, options) {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith('.ts') && !real.endsWith('.tsx')) return real;
  return siblingMockResolver(real) ?? real;
};
