import { registerReset } from "./mockRegistry.js";
import type { CleanupMode, SpyFn } from "./types.js";

/**
 * Wraps a mock adapter class so it behaves as a **transparent singleton** across a test
 * file: every `new TheAdapter()` — whether in the service under test or in a kit that
 * seeds it — returns the **same instance**, so seeded state is visible to all callers.
 *
 * On first construction it also spies on every method (skipping `reset`), so tests can
 * assert calls (`expect(adapter.upload).toHaveBeenCalledWith(...)`) as well as inspect
 * state.
 *
 * ## Choosing a cleanup mode
 *
 * `cleanup` decides what `cleanupMockAdapters()` does between tests. Pick the one that
 * matches how your app gets hold of the adapter.
 *
 * **`"reset"` (default)** — keep the instance, call `reset()` on it. Required when
 * anything captures the instance once and holds it, e.g. a module-level
 * `export const adapter = new Adapter()`. Nulling the reference would strand that export
 * pointing at a dead object forever, since nothing re-runs `new`.
 *
 * Note what `reset()` can and cannot clear: it clears the fields you list in it. It does
 * **not** touch spies, because they are not fields. A test that stubs an implementation —
 * `spy(adapter, 'fetch').mockResolvedValue(x)` — leaves that stub in place for the rest of
 * the file. `clearMocks` clears call history but not implementations; use `restoreMocks`
 * (or a one-shot `mockResolvedValueOnce`) if your tests stub through spies.
 *
 * **`"recreate"`** — drop the instance, so the next `new` builds a fresh one and re-spies
 * it. Safe only when the adapter is constructed per test (inside a kit or factory) rather
 * than captured at import. In exchange, nothing survives a test: state and spies both go,
 * because the object they lived on is gone. No `reset()` method is required in this mode.
 *
 * @example
 * // "reset" — a module-level singleton holds this instance
 * export const StorageAdapter = MockAdapter(
 *   class MockStorageAdapter implements IMockAdapter<StorageAdapter> {
 *     reset(): void { this.uploads = []; }
 *   },
 *   { spy: vi.spyOn },
 * );
 *
 * @example
 * // "recreate" — a kit constructs this per test
 * export const WidgetsAdapter = MockAdapter(
 *   class MockWidgetsAdapter { … },
 *   { spy: jest.spyOn, cleanup: "recreate" },
 * );
 */
export function MockAdapter<T extends { new (...args: any[]): object }>(
  Base: T,
  options: { spy: SpyFn; cleanup: "recreate" },
): T;
export function MockAdapter<T extends { new (...args: any[]): { reset(): void } }>(
  Base: T,
  options: { spy: SpyFn; cleanup?: "reset" },
): T;
export function MockAdapter(
  Base: { new (...args: any[]): any },
  options: { spy: SpyFn; cleanup?: CleanupMode },
): any {
  const mode: CleanupMode = options.cleanup ?? "reset";
  const holder = Base as typeof Base & { instance: any };
  holder.instance = null;
  registerReset(() => {
    if (mode === "recreate") {
      holder.instance = null; // next `new` builds a fresh instance, and re-spies it
      return;
    }
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
      holder.instance = this;
      return holder.instance;
    }
  };
}
