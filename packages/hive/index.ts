/**
 * @module hive
 * HoneyBook test kits infrastructure for building test frameworks and test runners.
 * Provides base classes and utilities for creating structured, dependency-aware testing environments.
 */

// Base classes
export { TestKit } from './test-kits/test-kit';
export { TestAppRunner, createAppRunner } from './app-runner/test-app-runner';

// Utilities
export {
    buildTestKitRecordFromArray,
    collectImplicitDependenciesDeep
} from './test-kits/test-kit.utils';

// Public types
export type {
    TestKitArrayToRecord,
    DependsOn,
    TestKitDeepDependencies,
    TestKitsDeepDependencies
} from './test-kits/test-kits.types';

// App runner types
export type {
    TestKitsClasses,
    TestKitsInstances,
    CombinedTestKitsResult,
    WithTestKitMethodBuilderSupport,
    AppRunnerWithChainableTestKitsMethods
} from './app-runner/app-runner.types';

// Internal types (for advanced usage)
export type {
    TestKitInstanceTupleToClassTypeTuple,
    CollectDeepDependenciesFromList,
    CollectDeepDependencies
} from './test-kits/test-kits.internal-types';
