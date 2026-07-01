# @honeybook/hive-mock-adapter

Framework-agnostic core for the transparent-singleton mock-adapter pattern — wrap a class once, get a stable spied singleton across a test file.

## Installation

```bash
pnpm add -D @honeybook/hive-mock-adapter
```

## Usage

```ts
import { MockAdapter, cleanupMockAdapters } from "@honeybook/hive-mock-adapter";
import type { IMockAdapter } from "@honeybook/hive-mock-adapter";
import { vi } from "vitest"; // or jest.spyOn for Jest

// Define a mock adapter class
const StorageAdapter = MockAdapter(
  class MockStorageAdapter implements IMockAdapter<any> {
    uploads: Array<{ key: string; data: any }> = [];

    async upload(key: string, data: any) {
      this.uploads.push({ key, data });
      return true;
    }

    reset(): void {
      this.uploads = [];
    }
  },
  // Inject the spy function (vi.spyOn for Vitest, jest.spyOn for Jest)
  { spy: vi.spyOn },
);

// Register cleanup in afterEach
afterEach(() => cleanupMockAdapters());

it("captures state across singleton instances", () => {
  const adapter1 = new StorageAdapter();
  const adapter2 = new StorageAdapter();

  // Same instance
  expect(adapter1).toBe(adapter2);

  adapter1.upload("key1", { value: 42 });
  expect(adapter2.uploads).toHaveLength(1);

  // Methods are spied
  expect(vi.isMockFunction(adapter1.upload)).toBe(true);
  expect(adapter1.upload).toHaveBeenCalledWith("key1", { value: 42 });
});
```

## API

- `MockAdapter` — wraps a class as a transparent spied singleton; takes `{ spy }`
- `registerReset` — registers a reset callback fired by `cleanupMockAdapters`
- `cleanupMockAdapters` — calls `reset()` in place on every registered adapter
- `IMockAdapter<T>` — interface a mock adapter class implements (requires `reset()`)
- `SpyFn` — type of the injected `spy` function

## Peer Dependencies

No peer dependencies.
