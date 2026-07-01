import { Constructor, UnionToTuple } from "type-fest";
import { TestKit } from "./test-kit";
import { DependsOn, TestKitDeepDependencies } from "./test-kits.types";

/** Helper type to check if a TestKit is already in the visited array */
type IsVisited<T extends TestKit, Visited extends TestKit[]> = T extends Visited[number]
  ? true
  : false;

/** Helper type to add a TestKit to the visited array if not already present */
type AddToVisited<T extends TestKit, Visited extends TestKit[]> =
  IsVisited<T, Visited> extends true ? Visited : [...Visited, T];

export type TestKitInstanceTupleToClassTypeTuple<T extends TestKit[]> = {
  [K in keyof T]: Constructor<T[K]>;
};

/**
 * Collects deep dependencies from an array of TestKit types without size limitations.
 * This processes multiple TestKits and returns all their combined transitive dependencies.
 *
 * @template TestKits - Array of TestKit types to analyze
 * @template Collected - Accumulator for collecting dependencies (internal)
 *
 * Example:
 * - Input: [UserTestKit, ProjectTestKit]
 * - UserTestKit deps: [UserTestKit, ApiAdapterTestKit, ConfigTestKit, AccountTestKit]
 * - ProjectTestKit deps: [ProjectTestKit, ApiAdapterTestKit, UserTestKit, CompanyTestKit, ConfigTestKit, AccountTestKit]
 * - Result: [UserTestKit, ApiAdapterTestKit, ConfigTestKit, AccountTestKit, ProjectTestKit, CompanyTestKit]
 */
export type CollectDeepDependenciesFromList<
  TestKits extends TestKit[],
  Collected extends TestKit[] = [],
> = TestKits extends readonly [infer First, ...infer Rest]
  ? First extends TestKit
    ? Rest extends TestKit[]
      ? CollectDeepDependenciesFromList<Rest, [...Collected, ...TestKitDeepDependencies<First>]>
      : UnionToTuple<Collected[number]>
    : UnionToTuple<Collected[number]>
  : UnionToTuple<Collected[number]>;

/**
 * Recursively collects all dependencies of a TestKit, including transitive dependencies.
 * Now relies on TypeScript's native recursion limits (~1000 levels) instead of artificial constraints.
 *
 * @template T - The TestKit to analyze
 * @template Visited - Array of already visited TestKits to prevent infinite recursion
 */
export type CollectDeepDependencies<T extends TestKit, Visited extends TestKit[] = []> =
  IsVisited<T, Visited> extends true
    ? Visited
    : T["dependentTestKitClasses"] extends DependsOn<infer DirectDeps>
      ? DirectDeps extends TestKit[]
        ? DirectDeps extends []
          ? AddToVisited<T, Visited>
          : CollectDeepDependenciesFromArray<DirectDeps, AddToVisited<T, Visited>>
        : AddToVisited<T, Visited>
      : AddToVisited<T, Visited>;

/**
 * Helper type to process an array of TestKits and collect their deep dependencies.
 * Uses tuple destructuring for unlimited array processing.
 */
type CollectDeepDependenciesFromArray<
  TestKits extends TestKit[],
  Visited extends TestKit[] = [],
> = TestKits extends readonly [infer First, ...infer Rest]
  ? First extends TestKit
    ? Rest extends TestKit[]
      ? CollectDeepDependenciesFromArray<Rest, CollectDeepDependencies<First, Visited>>
      : Visited
    : Visited
  : Visited;
