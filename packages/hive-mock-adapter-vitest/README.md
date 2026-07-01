# @honeybook/hive-mock-adapter-vitest

Vitest integration for `@honeybook/hive-mock-adapter`. Provides a transparent singleton mock-adapter pattern with automatic spy registration and a Vite plugin for zero-config mock file substitution.

## Installation

```bash
pnpm add -D @honeybook/hive-mock-adapter-vitest vitest@>=1
```

## Usage

### 1. Configure Vite plugin

In `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { mockSubstitutionPlugin } from "@honeybook/hive-mock-adapter-vitest";

export default defineConfig({
  plugins: [
    mockSubstitutionPlugin({
      paths: ["src/**/*.mock.ts"],
      // aliases: map package names to test-only replacements, e.g.:
      // aliases: { "@honeybook/some-sdk": "./src/testing/some-sdk.mock.ts" }
    }),
  ],
  test: {
    setupFiles: ["./src/setup.ts"],
    clearMocks: true,
  },
});
```

### 2. Setup file

Add the package's setup file to `vitest.config.ts` — it registers `afterEach(() => cleanupMockAdapters())` automatically:

```ts
test: {
  setupFiles: ["@honeybook/hive-mock-adapter-vitest/setup", "./src/setup.ts"],
  clearMocks: true,
},
```

Or register manually in your own setup file if you prefer:

```ts
import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter-vitest";
import { afterEach } from "vitest";

afterEach(() => cleanupMockAdapters());
```

### 3. Create a mock adapter

Colocate a `.mock.ts` file next to the real implementation:

```ts
// greeter.mock.ts
import { MockAdapter } from "@honeybook/hive-mock-adapter-vitest";
import type { IMockAdapter } from "@honeybook/hive-mock-adapter-vitest";

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

The plugin automatically substitutes `greeter.ts` imports with `greeter.mock.ts` during tests.

### 4. Assert in tests

```ts
import { describe, it, expect, vi } from "vitest";
import { Greeter } from "./greeter.js";

it("has spied greet method", () => {
  const g = new Greeter();
  g.greet("World");
  expect(vi.isMockFunction(g.greet)).toBe(true);
  expect(g.greet).toHaveBeenCalledWith("World");
});
```

## API

- `MockAdapter(Base)` — wraps a class as a singleton with auto-spy on all methods except `reset`
- `mockSubstitutionPlugin(opts)` — Vite/Vitest plugin for automatic `.mock.ts` substitution
- `siblingMockResolver(path)` — resolves `foo.ts` → `foo.mock.ts`
- `mocksDirResolver(path)` — resolves `foo.ts` → `__mocks__/foo.ts`
- `cleanupMockAdapters()` — calls `reset()` on all registered mock adapters
- `IMockAdapter<T>` — type helper for declaring mock adapter interfaces
