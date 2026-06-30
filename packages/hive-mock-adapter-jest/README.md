# @honeybook/hive-mock-adapter-jest

Jest integration for `@honeybook/hive-mock-adapter`. Provides a transparent singleton mock-adapter pattern with automatic spy registration and a Jest resolver for zero-config mock file substitution.

## Installation

```bash
pnpm add -D @honeybook/hive-mock-adapter-jest jest @types/jest ts-jest
```

## Usage

### 1. Configure Jest resolver

In `jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }]
  },
  resolver: require.resolve('./jest-resolver.cjs'),
  setupFilesAfterEnv: ['<rootDir>/src/setup.ts'],
  clearMocks: true,
};
```

Create `jest-resolver.cjs` in your project root:

```js
const { siblingMockResolver, mocksDirResolver } = require('@honeybook/hive-mock-adapter-jest');

module.exports = function(request, options) {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith('.ts') && !real.endsWith('.tsx')) return real;
  return siblingMockResolver(real) ?? mocksDirResolver(real) ?? real;
};
```

Or use the built-in resolver directly:

```js
module.exports = {
  resolver: require.resolve('@honeybook/hive-mock-adapter-jest/resolver'),
  // ...
};
```

### 2. Setup file

In `src/setup.ts`:

```ts
import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter-jest";

beforeEach(() => cleanupMockAdapters());
```

### 3. Create a mock adapter

Colocate a `.mock.ts` file next to the real implementation:

```ts
// greeter.mock.ts
import { MockAdapter } from "@honeybook/hive-mock-adapter-jest";
import type { IMockAdapter } from "@honeybook/hive-mock-adapter-jest";

export const Greeter = MockAdapter(
  class MockGreeter {
    greet(_name: string): string {
      return "";
    }
    reset(): void {}
  }
);
export type Greeter = InstanceType<typeof Greeter>;
```

The resolver automatically substitutes `greeter.ts` imports with `greeter.mock.ts` during tests.

### 4. Assert in tests

```ts
import { Greeter } from "../greeter.js";

it("has spied greet method", () => {
  const g = new Greeter();
  g.greet("World");
  expect(jest.isMockFunction(g.greet)).toBe(true);
  expect(g.greet).toHaveBeenCalledWith("World");
});
```

## API

- `MockAdapter(Base)` — wraps a class as a singleton with auto-spy on all methods except `reset`
- `siblingMockResolver(path)` — resolves `foo.ts` → `foo.mock.ts`
- `mocksDirResolver(path)` — resolves `foo.ts` → `__mocks__/foo.ts`
- `cleanupMockAdapters()` — calls `reset()` on all registered mock adapters
- `IMockAdapter<T>` — type helper for declaring mock adapter interfaces

The package also exports a ready-to-use CJS resolver at `@honeybook/hive-mock-adapter-jest/resolver`.
