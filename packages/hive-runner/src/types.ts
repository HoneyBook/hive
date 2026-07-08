import type {
  AppRunnerWithChainableTestKitsMethods,
  TestKitsInstances,
  TestKitArrayToRecord,
  TestKitClasses,
  MergeTestKits,
} from "@honeybook/hive";
import type { BaseTestRunner } from "./createBaseTestRunner";

// Sentinel types — used as defaults in RunnerFactory to signal "no extra methods"
// and "no execute hook". Never extends `void` to avoid collapsing conditional types.
export type NoMethods = never;
export type NoExecuteFn = never;

/**
 * Conditional-return mapped type for extra methods.
 * - void-returning methods → return Runner (chaining)
 * - non-void methods → return actual R (e.g. RTL RenderResult)
 *
 * [R] extends [void] uses a tuple to prevent distributive conditional:
 * `void extends void` is always true; `[void] extends [void]` is fine too
 * but `[Promise<void>] extends [void]` is false — preserving promise returns.
 *
 * NOTE: This type is NOT used inline in AppRunnerWithExtraMethods to avoid
 * TypeScript's TS2456 "circularly references itself" error — TypeScript treats
 * recursive type aliases through generic parameters as circular. It IS safe to
 * use externally and in RunnerFactory where the self-reference doesn't arise.
 */
export type RunnerMethodMap<
  AllMethods extends Record<string, (...args: any[]) => unknown>,
  Runner,
> = {
  [K in keyof AllMethods]: AllMethods[K] extends (...args: infer Args) => infer R
    ? (...args: Args) => [R] extends [void] ? Runner : R
    : never;
};

/**
 * Re-narrowing of AppRunnerWithChainableTestKitsMethods for hive runners.
 * The extra-methods mapped type is inlined (not via RunnerMethodMap) to avoid
 * TypeScript's TS2456 circular-reference detection on recursive type aliases.
 * The inlined form is semantically identical to RunnerMethodMap<ExtraMethods, Self>.
 */
export type AppRunnerWithExtraMethods<
  AllKitsClasses extends TestKitClasses,
  // Constraint is `object`, NOT Record<string, (...args) => unknown>. The index-signature
  // form is what makes an empty `{}` (the value the ban forces callers to write to skip
  // extra methods) INFER back to the index signature — silently readmitting any method name
  // on the runner, the very footgun the ban closes. `object` infers `{}` as `{}`; the mapped
  // type below already maps any non-function member to `never`, so no guarantee is lost.
  ExtraMethods extends object,
  Handle extends object = Record<never, never>,
> = AppRunnerWithChainableTestKitsMethods<
  AllKitsClasses,
  BaseTestRunner<AllKitsClasses, TestKitsInstances<AllKitsClasses>> &
    Handle & {
      [K in keyof ExtraMethods]: ExtraMethods[K] extends (...args: infer Args) => infer R
        ? (
            ...args: Args
          ) => [R] extends [void]
            ? AppRunnerWithExtraMethods<AllKitsClasses, ExtraMethods, Handle>
            : R
        : never;
    }
>;

export type RunnerThis<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
  Handle extends object = Record<never, never>,
> = AppRunnerWithExtraMethods<KitsClasses, ExtraMethods, Handle> & {
  testKitsMap: TestKitArrayToRecord<TestKitsInstances<KitsClasses>>;
};

// Internal helper — collapses `[never]` (no PlatformArg) to an empty rest tuple,
// keeping RunnerFactory signatures clean when PlatformArg is unused.
type PlatformArgs<T> = [T] extends [never] ? [] : [arg?: T];

// Internal helper — replaces `[T] extends [never] ? Fallback : T` repetition.
// Avoids the distributive form (`T extends never`) which evaluates to `never`.
type ResolveNever<T, Fallback extends object> = [T] extends [never] ? Fallback : T;

/**
 * The one shape every extra-methods record conforms to. Extracted so the
 * ban-undefined overloads and every consumer reference a single canonical
 * constraint instead of restating the index signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtraMethodsShape = Record<string, (...args: any[]) => unknown>;

/**
 * The full public runner type a factory returns for one call: the merged
 * kit list's chainable runner (carrying the caller's extra methods and the
 * platform Handle) intersected with the platform's fixed base methods.
 *
 * Extracted as a utility type so both RunnerFactory overloads — and any runner
 * that can't use RunnerFactory directly (e.g. createReactTestRunnerWithQueries,
 * which needs a per-call custom-query generic) — express their return and
 * ThisType targets identically, in one place.
 *
 * BaseKits and KitsClasses are combined via MergeTestKits, NOT
 * `[...BaseKits, ...KitsClasses]`. This is what makes wrapping a wrapper (any
 * number of layers deep) work: a wrapper factory that adds its own base kits and
 * stays generic over caller-supplied extraKits needs to call ITS OWN base kits'
 * methods from inside its own body, while extraKits is still an unresolved
 * generic parameter. Flattening into one array first would make that lookup fail
 * — see MergedTestKits in @honeybook/hive. KitsClasses may itself already be a
 * MergedTestKits (from an outer wrapper layer) — MergeTestKits flattens rather
 * than nesting, so depth is unlimited and every layer uses the identical
 * composition.
 *
 * BaseMethods is threaded through AppRunnerWithExtraMethods's `Handle` position
 * (intersected with any real execute-hook Handle), NOT intersected at the top
 * level. Handle is intersected RAW into the runner — never mapped through
 * RunnerMethodMap — so this preserves generic base-method signatures such as
 * renderHook<Result, Props>(...) and `this['result']`-returning render methods
 * exactly as a top-level intersection would (polymorphic `this` re-resolves to
 * the full runner at every call site, so a kit-INDEPENDENT base-methods
 * interface still yields the fully-merged result — which is what lets React use
 * a FIXED RunnerFactory instantiation instead of a bespoke generic function).
 * The reason it must go through Handle rather than the top level: Handle flows
 * into the runner that every chained `with*()` call returns, so `render`/
 * `renderHook`/`withBeforeRender` survive chaining (`runner.withX().render()`);
 * a top-level intersection is dropped after the first `with*()`.
 */
export type RunnerResult<
  BaseKits extends TestKitClasses,
  KitsClasses extends TestKitClasses,
  // `object`, not ExtraMethodsShape — see AppRunnerWithExtraMethods's ExtraMethods note.
  ExtraMethods extends object,
  Handle extends object = NoExecuteFn,
  BaseMethods extends object = NoMethods,
> = AppRunnerWithExtraMethods<
  MergeTestKits<[BaseKits, KitsClasses]>,
  ExtraMethods,
  ResolveNever<Handle, Record<never, never>> & ResolveNever<BaseMethods, Record<never, never>>
>;

/**
 * Typed factory shape for platform runners (React, Express, Temporal, …).
 *
 * BaseKits    = pre-seeded kit classes the factory always prepends (e.g. [typeof ReactTestKit])
 * Handle      = handle type merged onto the runner by an execute hook, or NoExecuteFn if unused
 * BaseMethods = methods the factory always provides (render, renderHook, …), or NoMethods if none
 * PlatformArg = trailing positional factory param type (e.g. getProviders, config), or never
 *
 * Authored as TWO overloads to close the explicit-`undefined` footgun: TypeScript
 * does NOT apply a generic parameter's default when a caller passes literal
 * `undefined` for an optional argument — it resolves the parameter to its
 * CONSTRAINT (an index signature) instead, silently admitting any method name on
 * the runner (as dangerous as `any`). So `extraMethods` is not an optional
 * generic-with-default on one signature; it is:
 *   1. absent entirely (kits-only overload) → ExtraMethods is the empty record, or
 *   2. REQUIRED (extraMethods+rest overload) → pass `{}` to skip it.
 * `create(kits, undefined)` matches neither overload — a hard compile error, by design.
 *
 * Author a runner by annotating a const with this type; the arrow's params take
 * loose types (the body casts through `as any` into createBaseTestRunner) because
 * contextual typing does not flow from an overloaded type into an arrow's params:
 *
 *   export const createXTestRunner: RunnerFactory<XBaseKits, XHandle, NoMethods, never> =
 *     (kits: TestKitClasses, extraMethods?: ExtraMethodsShape, ...rest: unknown[]) => { … as any };
 */
export type RunnerFactory<
  BaseKits extends TestKitClasses,
  Handle extends object = NoExecuteFn,
  BaseMethods extends object = NoMethods,
  PlatformArg = never,
> = {
  // Kits-only: ExtraMethods is the empty record; no extraMethods or platform arg reachable.
  <KitsClasses extends TestKitClasses>(
    kits: KitsClasses,
  ): RunnerResult<BaseKits, KitsClasses, Record<never, never>, Handle, BaseMethods>;
  // extraMethods REQUIRED (no `?`) — inferred from the object literal, with `this` bound to
  // the full runner. Platform arg (if any) is optional after it. Explicit `undefined` for
  // extraMethods matches neither overload.
  <KitsClasses extends TestKitClasses, ExtraMethods extends object>(
    kits: KitsClasses,
    extraMethods: ExtraMethods &
      ThisType<RunnerResult<BaseKits, KitsClasses, ExtraMethods, Handle, BaseMethods>>,
    ...rest: PlatformArgs<PlatformArg>
  ): RunnerResult<BaseKits, KitsClasses, ExtraMethods, Handle, BaseMethods>;
};
