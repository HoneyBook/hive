/**
 * @module hive
 * HoneyBook test kits infrastructure for building test frameworks and test runners.
 * Provides base classes and utilities for creating structured, dependency-aware testing environments.
 */

// Base classes
export { TestKit } from "./test-kits/test-kit";
export { AsyncTestKit } from "./test-kits/async-test-kit";
export { TestAppRunner, createAppRunner } from "./app-runner/test-app-runner";
export { isDeferred, createDeferred } from "./test-kits/deferred";

// Utilities
export {
  buildTestKitRecordFromArray,
  collectImplicitDependenciesDeep,
} from "./test-kits/test-kit.utils";
export { mergeTestKits } from "./test-kits/merge-test-kits";

// Public types
export type {
  TestKitClasses,
  TestKitArrayToRecord,
  DependsOn,
  TestKitDeepDependencies,
  TestKitsDeepDependencies,
} from "./test-kits/test-kits.types";
export type { MergedTestKits, MergeTestKits } from "./test-kits/merge-test-kits";
export type { Deferred } from "./test-kits/deferred";

// App runner types
export type {
  TestKitsInstances,
  CombinedTestKitsResult,
  CombinedTestKitsResultFromClasses,
  WithTestKitMethodBuilderSupport,
  AppRunnerWithChainableTestKitsMethods,
} from "./app-runner/app-runner.types";

// Internal types (for advanced usage)
export type {
  TestKitInstanceTupleToClassTypeTuple,
  CollectDeepDependenciesFromList,
  CollectDeepDependencies,
} from "./test-kits/test-kits.internal-types";
