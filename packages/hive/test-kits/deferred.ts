/**
 * A deferred payload for an async test kit's `with*` method.
 *
 * Produced by `runner.defer(cb)` and passed into a `with*` call:
 *
 *   runner.withConversation(runner.defer(async (kits) => ({
 *     attachmentId: (await kits.AttachmentKit.value).id,
 *   })));
 *
 * Unlike the eager `(result) => payload` callback — which runs at chain-time
 * against the synchronous `result` — a Deferred is drained at RESOLVE-time by
 * the async flush, after its dependencies' `build()` has settled, so the
 * callback can `await kits.X.value`. Async-only: passing a Deferred to a
 * synchronous kit's `with*` throws.
 */
const DEFER_BRAND: unique symbol = Symbol.for("@honeybook/hive/deferred");

export interface Deferred<TPayload> {
  readonly [DEFER_BRAND]: true;
  /** Runs the user callback (bound to the runner's testKitsMap); awaited at resolve-time. */
  invoke(): Promise<TPayload>;
}

/** Type guard: is `value` a Deferred produced by `runner.defer()`? */
export function isDeferred(value: unknown): value is Deferred<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[DEFER_BRAND] === true
  );
}

/**
 * Wraps an invocation thunk as a branded Deferred. Internal building block —
 * runners expose it via `runner.defer(cb)`, which binds `cb` to their own
 * `testKitsMap` before handing it here.
 */
export function createDeferred<TPayload>(
  invoke: () => TPayload | Promise<TPayload>,
): Deferred<TPayload> {
  return {
    [DEFER_BRAND]: true,
    invoke: () => Promise.resolve(invoke()),
  };
}
