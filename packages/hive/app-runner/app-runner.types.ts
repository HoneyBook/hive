import { UnionToIntersection } from "type-fest";
import { TestAppRunner } from "./test-app-runner";
import { TestKit } from "../test-kits/test-kit";
import { TestKitClasses } from "../test-kits/test-kits.types";
import { MergedTestKits } from "../test-kits/merge-test-kits";

/** Destruct the first item type in the array out and keep the rest */
export type Tail<T extends any[]> = T extends [T[0], ...infer Rest] ? Rest : [];

export type TestKitsInstances<TKClasses extends TestKitClasses> = Array<
  InstanceType<TKClasses[number]>
>;

/**
 * Combine all the results of the provided test kit instances.
 *
 * Guarded against an empty `TestKits` with `[TestKits[number]] extends [never]`
 * (a tuple wrapper, not a naked check) — `TestKits[number]` for `[]` is `never`,
 * and TS collapses ANY distributive conditional to `never` when fed a naked
 * `never`, which `UnionToIntersection` is. Left unguarded, an empty source
 * resolves to `never` instead of the neutral `unknown`, which poisons any
 * intersection it's a part of (`X & never` is `never`, but `X & unknown` is
 * `X`) — exactly the case `CombinedTestKitsResultFromClasses` relies on this
 * type being safe for.
 */
export type CombinedTestKitsResult<TestKits extends Array<TestKit> = []> = [
  TestKits[number],
] extends [never]
  ? unknown
  : UnionToIntersection<TestKits[number]["result"]>;

/**
 * Recursively intersects tuple elements — `X & unknown` is `X`, so an
 * unresolved source degrades harmlessly instead of poisoning the whole
 * intersection. `UnionToIntersection` can't offer this guarantee on its own:
 * it distributes over a union, and a union with an unresolved member can't
 * be distributed over without losing the resolved members too.
 */
type IntersectTuple<T extends readonly unknown[]> = T extends readonly [infer Head, ...infer Rest]
  ? Head & IntersectTuple<Rest>
  : unknown;

/**
 * Same as `CombinedTestKitsResult`, computed from TestKit classes rather than
 * instances. When `TKClasses` is a `MergedTestKits` composite, computes the
 * result per tracked source and intersects the results — see `MergedTestKits`
 * for why this matters when kits are composed across a still-generic wrapper
 * layer (e.g. a factory that adds its own base kits and stays generic over
 * caller-supplied `extraKits`).
 *
 * Recurses into `CombinedTestKitsResultFromClasses<Sources[I]>` (itself) rather
 * than assuming `Sources[I]` is always a plain, already-flattened array — a
 * slot can itself be a nested `MergedTestKits` (from a wrapped wrapper).
 * `Sources` is never pre-flattened (see `MergedTestKits`), so this recursion is
 * what makes N-layer nesting resolve correctly instead of relying on the
 * `{ [I in keyof Sources]: ... }` mapping alone.
 */
export type CombinedTestKitsResultFromClasses<TKClasses extends TestKitClasses> =
  TKClasses extends MergedTestKits<infer Sources>
    ? IntersectTuple<{
        [I in keyof Sources]: CombinedTestKitsResultFromClasses<Sources[I]>;
      }>
    : CombinedTestKitsResult<TestKitsInstances<TKClasses>>;

/** Extract all the "withX" methods from test kits and change their first arg to be able to receive function.
 *  This function has only one arg that is the result of all the test kits.
 *  The idea is that you can use test kits result that were init before calling this test method in order to create
 *  the fixture data.*/
export type WithTestKitMethodBuilderSupport<
  TTestKit extends TestKit,
  AllTestKits extends Array<TestKit>,
> = {
  [
    Key in keyof TTestKit as Key extends `with${string}`
      ? TTestKit[Key] extends (...args: any[]) => any
        ? Key
        : never
      : never
  ]: TTestKit[Key] extends (...args: infer Args) => infer Return
    ? (
        ...args:
          | Args
          | [
              testKitsResultOverloadFunction: (
                result: CombinedTestKitsResult<AllTestKits>,
              ) => Args[0],
              ...args: Tail<Args>,
            ]
      ) => Return
    : never;
};

/**
 * Combine the provided test kits methods as builder test kit methods.
 *
 * Guarded against an empty `TestKits` the same way `CombinedTestKitsResult` is
 * — `type-fest`'s `UnionToIntersection<Union>` resolves to `Intersection & Union`,
 * and for `Union = never` (an empty `TestKits`) that's `unknown & never`, which
 * is `never`, not `unknown`. Left unguarded, an empty source's contribution to
 * `IntersectTuple` (`Head & IntersectTuple<Rest>`) is `never`, and `X & never`
 * is `never` unconditionally — collapsing the WHOLE composite (including every
 * concrete source's real methods) to `never` instead of degrading harmlessly.
 */
type CombineTestKitsBuilderMethods<TestKits extends Array<TestKit>> = [TestKits[number]] extends [
  never,
]
  ? unknown
  : UnionToIntersection<WithTestKitMethodBuilderSupport<TestKits[number], TestKits>>;

/**
 * Same as `CombineTestKitsBuilderMethods`, computed from TestKit classes, per
 * tracked source when `TKClasses` is a `MergedTestKits` composite — see
 * `CombinedTestKitsResultFromClasses`/`MergedTestKits`. Recurses into
 * `CombineTestKitsBuilderMethodsFromClasses<Sources[I]>` (itself) for the same
 * reason `CombinedTestKitsResultFromClasses` does — a slot may itself be a
 * nested `MergedTestKits`, since `Sources` is never pre-flattened.
 */
type CombineTestKitsBuilderMethodsFromClasses<TKClasses extends TestKitClasses> =
  TKClasses extends MergedTestKits<infer Sources>
    ? IntersectTuple<{
        [I in keyof Sources]: CombineTestKitsBuilderMethodsFromClasses<Sources[I]>;
      }>
    : CombineTestKitsBuilderMethods<TestKitsInstances<TKClasses>>;

/** Convert all the "withX" builder methods to support chaining with the provided app runner.
 * This type basically add support to `testAppRunner.withX().withOtherX();`
 * The original with methods of the test kits doesn't know their app runner so this a way of enabling it */
export type AppRunnerWithChainableTestKitsMethods<
  TKClasses extends TestKitClasses,
  AppRunner extends TestAppRunner<TKClasses>,
> = AppRunner & {
  [
    Key in keyof CombineTestKitsBuilderMethodsFromClasses<TKClasses>
  ]: CombineTestKitsBuilderMethodsFromClasses<TKClasses>[Key] extends (...args: infer Args) => any
    ? (...args: Args) => AppRunner & AppRunnerWithChainableTestKitsMethods<TKClasses, AppRunner>
    : never;
};
