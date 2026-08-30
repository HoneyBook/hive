export type IMockAdapter<T = object> = T & { reset(): void };
export type SpyFn = (obj: object, key: string) => unknown;

/**
 * What `cleanupMockAdapters()` does to an adapter between tests.
 *
 * - `"reset"` (default) — keep the instance, call `reset()` on it. Required when
 *   something captures the instance once, such as a module-level
 *   `export const adapter = new Adapter()`.
 * - `"recreate"` — drop the instance so the next `new` builds and re-spies a fresh one.
 *   For adapters constructed per test. Needs no `reset()` method.
 */
export type CleanupMode = "reset" | "recreate";
