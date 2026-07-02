import { TestKitClasses } from "./test-kits.types";

/**
 * Phantom brand key — never assigned at runtime, exists only so the type
 * checker can distinguish a `MergedTestKits<Sources>` from a plain
 * `TestKitClasses` via `T extends MergedTestKits<infer Sources>`.
 */
declare const MERGE_SOURCES: unique symbol;

/**
 * A composite of TestKit-class arrays that still remembers which array each
 * class came from, instead of collapsing into one flat, undifferentiated
 * array the moment two kit lists are combined.
 *
 * This matters for exactly one reason: a wrapper factory that adds its own
 * base kits and stays generic over caller-supplied `extraKits` needs to call
 * its OWN base kits' methods from inside its own body, while `extraKits` is
 * still an unresolved generic parameter. If the two arrays are flattened into
 * one tuple first, `UnionToIntersection` (used to compute `.result` and
 * chainable `with*` methods) has to distribute over a union whose membership
 * is itself unresolved — and it silently loses the concrete members' fields,
 * not just the unresolved ones. Keeping sources as a fixed-length tuple (this
 * type) instead lets every consumer of `Sources` (`CombinedTestKitsResult`,
 * `AppRunnerWithChainableTestKitsMethods`) compute per-source and intersect
 * the results — `Concrete & Unresolved` still keeps `Concrete`'s fields no
 * matter what `Unresolved` degrades to, because intersecting with a
 * best-effort placeholder for an unresolved source is a no-op, not a
 * collapse. See `mergeTestKits`.
 *
 * A `MergedTestKits<Sources>` value is structurally still just a flat array
 * of TestKit classes at runtime and remains assignable anywhere a plain
 * `TestKitClasses` is expected — the source tracking is a type-level-only
 * brand, invisible at runtime and to any code that doesn't care about it.
 */
export type MergedTestKits<Sources extends ReadonlyArray<TestKitClasses>> = Array<
  Sources[number][number]
> & {
  readonly [MERGE_SOURCES]: Sources;
};

/**
 * Recovers the tracked source list from an argument to `mergeTestKits` — unwraps
 * an already-merged composite so composing merges stays flat, never nested.
 *
 * The ELSE branch returns `readonly [T]`, NOT `readonly [T & TestKitClasses]` —
 * intersecting a specific constructor type (e.g. `typeof UserKit`) with the
 * generic `TestKitClasses` bound (`new () => TestKit`) corrupts `InstanceType`
 * resolution: TS's `infer` over an intersection of two constructor signatures
 * binds to the WIDER one, silently losing the specific kit's own shape (every
 * `with*` method disappears). `T`'s own constraint (`T extends TestKitClasses`)
 * already proves it fits — no intersection needed.
 */
export type SourceOf<T extends TestKitClasses> =
  T extends MergedTestKits<infer Sources> ? Sources : readonly [T];

export type FlattenMergeSources<Args extends ReadonlyArray<TestKitClasses>> =
  Args extends readonly [
    infer Head extends TestKitClasses,
    ...infer Rest extends ReadonlyArray<TestKitClasses>,
  ]
    ? readonly [...SourceOf<Head>, ...FlattenMergeSources<Rest>]
    : readonly [];

/**
 * Type-level equivalent of `mergeTestKits(...)` — the combined `MergedTestKits`
 * type for a tuple of arguments, without actually calling the function. Used by
 * `RunnerFactory` to combine its own fixed `BaseKits` with whatever the caller
 * passed as `kits` (which may itself already be a `MergedTestKits` from an
 * outer wrapper layer), the same associative way `mergeTestKits` does.
 *
 * `MergedTestKits<any>` is not listed separately from `TestKitClasses` — it
 * already structurally satisfies `TestKitClasses` (a `MergedTestKits` value is
 * a real array of TestKit classes plus a phantom brand), so a single bound
 * covers both a plain kits array and an already-merged composite.
 */
export type MergeTestKits<Args extends ReadonlyArray<TestKitClasses>> = MergedTestKits<
  FlattenMergeSources<Args>
>;

/**
 * Combines any number of TestKit-class arrays — including ones that are
 * themselves still-unresolved generic parameters (e.g. a caller-supplied
 * `extraKits` argument) — into a single `MergedTestKits` composite, without
 * losing the ability to resolve concrete members' `.result` fields and
 * chainable `with*` methods from inside a still-generic wrapper body.
 *
 * Composable: merging an already-merged composite with more kits flattens
 * into one tracked source list rather than nesting, so wrapping a wrapper
 * (any number of layers deep) works with the exact same call shape at every
 * layer — `mergeTestKits(myOwnBaseKits, extraKitsFromCaller)` — regardless of
 * whether `extraKitsFromCaller` is a plain array or itself a `MergedTestKits`
 * passed down from an outer layer.
 *
 * @example
 * ```ts
 * function createServiceTestRunner<ExtraKits extends TestKitClasses = readonly []>(
 *   extraKits: ExtraKits = [] as unknown as ExtraKits,
 * ) {
 *   const kits = mergeTestKits(SERVICE_BASE_KITS, extraKits);
 *   const runner = createExpressTestRunner(kits, {
 *     withAiEmployeeHeaders() {
 *       this.withHeaders({ ... }); // resolves — RequestConfigTestKit is a concrete source
 *     },
 *   });
 *   runner.withApp(app); // resolves — same reason
 *   return runner;
 * }
 * ```
 */
export function mergeTestKits<Args extends ReadonlyArray<TestKitClasses>>(
  ...sources: Args
): MergeTestKits<Args> {
  return sources.flat() as unknown as MergeTestKits<Args>;
}
