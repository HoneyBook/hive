import { registerReset } from "./mockRegistry.js";
import type { SpyFn } from "./types.js";

/**
 * Wraps a mock adapter class so it behaves as a **transparent singleton** across the
 * **entire test file**: every `new TheAdapter()` — whether in the service under test or in
 * a kit that seeds it — returns the **same instance**, so seeded state is visible to all
 * callers. The instance identity is **stable** across tests; it is never replaced.
 *
 * On first construction it also spies on every method (skipping `reset`), so tests can
 * assert calls (`expect(adapter.upload).toHaveBeenCalledWith(...)`) as well as inspect
 * state. `clearMocks: true` in `vitest.config.ts` / jest config clears spy call history
 * each `beforeEach` independently of the instance reset.
 *
 * @example
 * // r2-storage-adapter.mock.ts — colocated with r2-storage-adapter.ts
 * export const R2StorageAdapter = MockAdapter(
 *   class MockR2StorageAdapter implements StorageAdapter, IMockAdapter<StorageAdapter> {
 *     reset(): void { this.uploads = []; }
 *   },
 *   { spy: vi.spyOn },
 * );
 */
export function MockAdapter<T extends { new (...args: any[]): { reset(): void } }>(
  Base: T,
  options: { spy: SpyFn },
): T {
  const holder = Base as T & { instance: InstanceType<T> | null };
  holder.instance = null;
  registerReset(() => {
    holder.instance?.reset(); // reset in place — never null the ref
  });

  return class extends Base {
    constructor(...args: any[]) {
      if (holder.instance) {
        return holder.instance;
      }
      super(...args);
      Object.getOwnPropertyNames(Base.prototype).forEach((key) => {
        if (key !== "constructor" && key !== "reset" && typeof (this as any)[key] === "function") {
          options.spy(this as any, key);
        }
      });
      holder.instance = this as unknown as InstanceType<T>;
      return holder.instance;
    }
  } as T;
}
