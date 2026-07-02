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
 * still an unresolved generic parameter. Keeping sources as a fixed-length
 * tuple (this type) lets every consumer of `Sources`
 * (`CombinedTestKitsResultFromClasses`, `AppRunnerWithChainableTestKitsMethods`)
 * compute per-source and intersect the results — `Concrete & Unresolved`
 * still keeps `Concrete`'s fields no matter what `Unresolved` degrades to,
 * because intersecting with a best-effort placeholder for an unresolved
 * source is a no-op, not a collapse.
 *
 * `Sources` is NEVER eagerly flattened at the type level — `MergeTestKits<Args>`
 * tracks `Args` exactly as given (see below). Eagerly flattening (unwrapping
 * an already-merged inner composite into the outer tuple ahead of time) was
 * tried and reverted: spreading a still-unresolved generic slot's unknown
 * inner shape into the outer tuple made the OUTER tuple's own length
 * unknowable to the type checker, which breaks the homomorphic
 * `{ [I in keyof Sources]: ... }` mapping this whole mechanism depends on —
 * even for sibling slots that are fully concrete. Recursing into a nested
 * `MergedTestKits` slot from WITHIN each consumer instead (rather than
 * flattening ahead of time) keeps every level's `Sources` tuple at a
 * syntactically fixed length (exactly the number of arguments passed to that
 * level's own `mergeTestKits` call), so only slot VALUES are ever generic —
 * never the tuple's shape.
 *
 * A `MergedTestKits<Sources>` value is structurally still just a flat array
 * of TestKit classes at runtime and remains assignable anywhere a plain
 * `TestKitClasses` is expected — the source tracking is a type-level-only
 * brand, invisible at runtime and to any code that doesn't care about it.
 *
 * The array element type (`Sources[number][number]`) recurses through nested
 * `MergedTestKits` slots for free, via plain indexed access — no explicit
 * conditional-type check needed: indexing `[number]` on an intersection whose
 * first member is `Array<X>` yields `X` directly, so if a slot is itself a
 * `MergedTestKits<InnerSources>`, indexing into it already yields
 * `InnerSources[number][number]`. (An earlier attempt added an explicit
 * `T extends MergedTestKits<infer S> ? ... : T[number]` helper here to make
 * this recursion "look" intentional — DON'T reintroduce that: referencing
 * `MergedTestKits` from within a type used to DEFINE `MergedTestKits`'s own
 * array element type is self-referential and hits TS's "type instantiation
 * is excessively deep" limit even for finite, correctly-terminating cases.)
 */
export type MergedTestKits<Sources extends ReadonlyArray<TestKitClasses>> = Array<
  Sources[number][number]
> & {
  readonly [MERGE_SOURCES]: Sources;
};

/**
 * Type-level equivalent of `mergeTestKits(...)` — the combined `MergedTestKits`
 * type for a tuple of arguments, without actually calling the function. Used by
 * `RunnerFactory` to combine its own fixed `BaseKits` with whatever the caller
 * passed as `kits` (which may itself already be a `MergedTestKits` from an
 * outer wrapper layer), the same associative way `mergeTestKits` does.
 *
 * `Args` is tracked as-is — no flattening. Composability across any number of
 * wrapper layers comes from `CombinedTestKitsResultFromClasses` /
 * `CombineTestKitsBuilderMethodsFromClasses` recursing into a nested
 * `MergedTestKits` slot, not from flattening the `Sources` tuple ahead of time.
 */
export type MergeTestKits<Args extends ReadonlyArray<TestKitClasses>> = MergedTestKits<Args>;

/**
 * Combines any number of TestKit-class arrays — including ones that are
 * themselves still-unresolved generic parameters (e.g. a caller-supplied
 * `extraKits` argument) — into a single `MergedTestKits` composite, without
 * losing the ability to resolve concrete members' `.result` fields and
 * chainable `with*` methods from inside a still-generic wrapper body.
 *
 * Composable: an already-merged composite passed as one of the arguments is
 * tracked as its own nested slot rather than being flattened in — every
 * layer, at any depth, calls the exact same shape —
 * `mergeTestKits(myOwnBaseKits, extraKitsFromCaller)` — regardless of whether
 * `extraKitsFromCaller` is a plain array or itself a `MergedTestKits` passed
 * down from an outer layer. At RUNTIME the result is still a genuinely flat
 * array (`sources.flat()`) — nesting only exists at the type level, to keep
 * each level's `Sources` tuple a fixed length for the type checker.
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
