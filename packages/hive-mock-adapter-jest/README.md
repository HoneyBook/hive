# @honeybook/hive-mock-adapter-jest

Jest integration for `@honeybook/hive-mock-adapter`. Provides a transparent singleton mock-adapter pattern with automatic spy registration and a Jest resolver for zero-config mock file substitution.

## Why use this?

Instead of reaching for `jest.mock()` or `jest.spyOn()` at the call site, `MockAdapter` wraps a class once — at definition time — and gives every test the same singleton instance with all methods already spied. Between tests, `cleanupMockAdapters()` calls `reset()` on the instance in place (never replaces it), so backend module-level singletons that capture the adapter at import time always have a live reference pointing at the same object.

For more info on the adapter pattern and why we use it, read: <!-- link to atlas-service adapter pattern doc -->

## Installation

```bash
pnpm add -D @honeybook/hive-mock-adapter-jest jest@>=29 @types/jest ts-jest
```

## Usage

### 1. Configure Jest resolver

In `jest.config.js`, use the built-in resolver (`.mock.ts` sibling substitution only):

```js
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { diagnostics: false }],
  },
  resolver: require.resolve("@honeybook/hive-mock-adapter-jest/resolver"),
  setupFilesAfterEnv: ["<rootDir>/src/setup.ts"],
  clearMocks: true,
};
```

To also support `__mocks__/` directory substitution, compose resolvers in your own `jest-resolver.cjs`:

```js
const {
  siblingMockResolver,
  mocksDirResolver,
} = require("@honeybook/hive-mock-adapter-jest/resolvers");

module.exports = function (request, options) {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith(".ts") && !real.endsWith(".tsx")) return real;
  return siblingMockResolver(real) ?? mocksDirResolver(real) ?? real;
};
```

Then point jest at it:

```js
module.exports = {
  resolver: require.resolve("./jest-resolver.cjs"),
  // ...
};
```

### 2. Setup file

Add the package's setup file to `jest.config.js` — it registers `afterEach(() => cleanupMockAdapters())` automatically:

```js
setupFilesAfterEnv: ["@honeybook/hive-mock-adapter-jest/setup"],
```

Or register manually in your own setup file if you prefer:

```ts
import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter-jest";

afterEach(() => cleanupMockAdapters());
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
  },
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

- `MockAdapter(Base, options?)` — wraps a class as a singleton with auto-spy on all methods except `reset`
  - `options.cleanup: "reset"` (default) — keep the instance between tests and call `reset()` on it. For an adapter something holds a long-lived reference to, e.g. a module-level `export const adapter = new Adapter()`.
  - `options.cleanup: "recreate"` — drop the instance so the next `new` builds and re-spies a fresh one. For an adapter a kit or factory constructs per test. Needs no `reset()` method, and a spy a test planted cannot leak into the next test.
- `siblingMockResolver(path)` — resolves `foo.ts` → `foo.mock.ts` _(from `/resolvers`)_
- `mocksDirResolver(path)` — resolves `foo.ts` → `__mocks__/foo.ts` _(from `/resolvers`)_
- `cleanupMockAdapters()` — calls `reset()` on all registered mock adapters
- `IMockAdapter<T>` — type helper for declaring mock adapter interfaces

The package exports a ready-to-use CJS resolver at `@honeybook/hive-mock-adapter-jest/resolver` (`.mock.ts` sibling only). Compose `siblingMockResolver` and `mocksDirResolver` yourself when you need both conventions.

### Why the resolvers live on a subpath

The resolvers import `node:fs` and `node:path` to look for mock files on disk. That is
correct for jest config, which is CJS and runs in Node — and fatal in a browser bundle,
where rspack and webpack reject the `node:` scheme outright.

`MockAdapter` is imported by mock adapter files, and those are reachable from application
code (through a test kit, a harness, or a `__mocks__` twin re-exported from a package
barrel). If the root entry re-exported the resolvers, any bundler following that chain
would fail on `node:fs` even though nothing at runtime ever calls a resolver.

So the root entry stays free of Node built-ins, and the resolvers live behind
`/resolvers`. Import them only from jest config.
