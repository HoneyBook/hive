// CJS shim — loaded by jest via require.resolve; re-implements the resolver in CJS
const { existsSync } = require('node:fs');
const path = require('node:path');

function siblingMockResolver(realPath) {
  const match = realPath.match(/^(.*)\.(tsx?)$/);
  if (!match) return null;
  const candidate = `${match[1]}.mock.${match[2]}`;
  if (existsSync(candidate)) return candidate;
  return null;
}

function mocksDirResolver(realPath) {
  const dir = path.dirname(realPath);
  const filename = realPath.slice(dir.length + 1);
  const candidate = path.resolve(dir, '__mocks__', filename);
  if (existsSync(candidate)) return candidate;
  return null;
}

module.exports = function mockSubstitutionResolver(request, options) {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith('.ts') && !real.endsWith('.tsx')) return real;
  return siblingMockResolver(real) ?? mocksDirResolver(real) ?? real;
};
