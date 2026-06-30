import { TestKit } from './test-kit';
import {
    CollectDeepDependenciesFromList,
    CollectDeepDependencies,
    TestKitInstanceTupleToClassTypeTuple
} from './test-kits.internal-types';
/**
 * Helper type to convert an array of TestKit classes to a record of TestKit classes.
 *
 * Example:
 * ```typescript
 * type TestKitsRecord = TestKitArrayToRecord<[ProjectTestKit, ConfigTestKit]>;
 * // Returns { ProjectTestKit: ProjectTestKit, ConfigTestKit: ConfigTestKit }
 * ```
 */
export type TestKitArrayToRecord<T extends Array<TestKit>> = {
    [Key in T[number] as Key['name']]: Key;
};

/**
 * Helper type to describe a list of TestKits classes types when providing a list of TestKit instances.
 *
 * Example:
 * ```typescript
 * type DependsOn<[ProjectTestKit, ConfigTestKit]>
 * // Returns [typeof ProjectTestKit, typeof ConfigTestKit]
 */
export type DependsOn<Ts extends Array<TestKit>> =
    TestKitInstanceTupleToClassTypeTuple<Ts>;

/**
 * Collects all dependencies of a TestKit as a tuple deep.
 * This includes direct dependencies and all their dependencies recursively.
 *
 * Example:
 * - If TestKitA depends on [TestKitB, TestKitC]
 * - And TestKitB depends on [TestKitD]
 * - And TestKitC depends on [TestKitE, TestKitF]
 * - Then TestKitDeepDependencies<TestKitA> = [TestKitA, TestKitB, TestKitC, TestKitD, TestKitE, TestKitF]
 */
export type TestKitDeepDependencies<T extends TestKit> =
    CollectDeepDependencies<T>;

/**
 * Collects all deep dependencies from an array of TestKit types.
 * Returns a flattened, deduplicated array of all TestKits in the combined dependency tree.
 *
 * @template TestKits - Array of TestKit types to analyze
 *
 * Use Cases:
 * - Analyzing the combined dependency footprint of multiple TestKits
 * - Understanding what gets initialized when using multiple TestKits together
 * - Optimizing test setup by identifying common dependencies
 * - Generating comprehensive dependency graphs for multiple features
 *
 * Example:
 * ```typescript
 * type CombinedDeps = TestKitsDeepDependencies<[UserTestKit, ProjectTestKit, ContactTestKit]>;
 * // Returns all unique TestKits across all three dependency trees
 * ```
 */
export type TestKitsDeepDependencies<TestKits extends Array<TestKit>> =
    CollectDeepDependenciesFromList<TestKits>;
