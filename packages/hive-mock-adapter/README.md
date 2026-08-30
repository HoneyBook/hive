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

## Cleanup between tests

`cleanupMockAdapters()` runs between tests. What it does to an adapter depends on the
`cleanup` option you passed to `MockAdapter`.

|                          | `"reset"` (default)       | `"recreate"`                           |
| ------------------------ | ------------------------- | -------------------------------------- |
| The instance             | kept                      | dropped; next `new` builds a fresh one |
| State                    | whatever `reset()` clears | gone with the object                   |
| Spies a test planted     | **survive**               | gone with the object                   |
| Needs a `reset()` method | yes                       | no                                     |

**Use `"reset"` when something captures the instance once** — most commonly a
module-level `export const adapter = new Adapter()`. Dropping the instance would leave
that export pointing at a dead object forever, because nothing re-runs `new`.

**Use `"recreate"` when a kit or factory constructs the adapter per test.** Nothing holds
a long-lived reference, so a fresh object each test is safe — and it means a test can't
leak into the next one.

That last row is the part worth reading twice. `reset()` clears the fields you list in it.
It cannot clear spies, because spies aren't fields. So under `"reset"`, this leaks:

```ts
it("one", () => {
  spy(adapter, "fetch").mockResolvedValue(somethingSpecific); // no `Once`
});

it("two", () => {
  // `fetch` still returns somethingSpecific
});
```

`clearMocks` does not save you — it clears call history, not implementations. If your
tests stub through spies under `"reset"`, use `restoreMocks`, or the one-shot
`mockResolvedValueOnce`. Under `"recreate"` the problem doesn't arise: the object the spy
lived on is gone.

## API

- `MockAdapter` — wraps a class as a transparent spied singleton; takes `{ spy }`
- `registerReset` — registers a reset callback fired by `cleanupMockAdapters`
- `cleanupMockAdapters` — calls `reset()` in place on every registered adapter
- `IMockAdapter<T>` — interface a mock adapter class implements (requires `reset()`)
- `SpyFn` — type of the injected `spy` function

## Peer Dependencies

No peer dependencies.
