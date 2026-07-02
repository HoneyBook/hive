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
  ExtraMethods extends Record<string, (...args: any[]) => unknown>,
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
 * Typed factory shape for platform runners (React, Express, Temporal).
 *
 * BaseKits    = pre-seeded kit classes the factory always prepends (e.g. [typeof ReactTestKit])
 * ExecuteFn   = execute hook type, or NoExecuteFn if unused
 * BaseMethods = methods the factory always provides (render, renderHook, …)
 * PlatformArg = third factory param type, or never if unused
 *
 * The return type is AppRunnerWithExtraMethods<MergeTestKits<[BaseKits, KitsClasses]>, ...>,
 * so runner.result includes both pre-seeded and user-provided kit results.
 *
 * BaseKits and KitsClasses are combined via MergeTestKits, NOT `[...BaseKits, ...KitsClasses]`.
 * This is what makes wrapping a wrapper (any number of layers deep) work: a wrapper factory
 * that adds its own base kits and stays generic over caller-supplied extraKits needs to call
 * ITS OWN base kits' methods from inside its own body, while extraKits is still an unresolved
 * generic parameter. Flattening into one array first would make that lookup fail — see
 * MergedTestKits in @honeybook/hive for the full mechanism. KitsClasses may itself already be
 * a MergedTestKits (passed down from an outer wrapper layer) — MergeTestKits flattens rather
 * than nesting, so depth is unlimited and every layer uses the identical composition.
 *
 * BaseMethods are intersected DIRECTLY into the return type (not through
 * RunnerMethodMap / AppRunnerWithExtraMethods). This preserves generic
 * method signatures such as renderHook<Result, Props>(...).
 */
export type RunnerFactory<
  BaseKits extends TestKitClasses,
  ExecuteFn extends object = NoExecuteFn,
  BaseMethods extends object = Record<never, never>,
  PlatformArg = never,
> = <
  KitsClasses extends TestKitClasses,
  // Defaults directly to Record<never, never> (not NoMethods/never + ResolveNever) —
  // ExtraMethods is inferred per-call from the extraMethods argument, and feeding a
  // conditional type built FROM ExtraMethods back into that same argument's ThisType
  // silently defeats bidirectional inference (TS falls back to the default instead of
  // inferring from the object literal, with no compile error). ExecuteFn/BaseMethods
  // don't have this problem — they're fixed by the named factory's own RunnerFactory<...>
  // instantiation, not inferred per end-caller.
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
>(
  kits: KitsClasses,
  extraMethods?: ExtraMethods &
    ThisType<
      AppRunnerWithExtraMethods<
        MergeTestKits<[BaseKits, KitsClasses]>,
        ExtraMethods,
        ResolveNever<ExecuteFn, Record<never, never>>
      > &
        ResolveNever<BaseMethods, Record<never, never>>
    >,
  ...rest: PlatformArgs<PlatformArg>
) => AppRunnerWithExtraMethods<
  MergeTestKits<[BaseKits, KitsClasses]>,
  ExtraMethods,
  ResolveNever<ExecuteFn, Record<never, never>>
> &
  ResolveNever<BaseMethods, Record<never, never>>;
