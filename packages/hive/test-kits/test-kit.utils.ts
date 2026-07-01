import { TestKit } from "./test-kit";
import { TestKitArrayToRecord } from "./test-kits.types";

export function buildTestKitRecordFromArray<TestKits extends TestKit[]>(testKits: TestKit[]) {
  return testKits.reduce((result, testKit) => {
    (result as Record<string, TestKit>)[testKit.name] = testKit;

    return result;
  }, {} as TestKitArrayToRecord<TestKits>);
}

/**
 * Collects all implied dependencies for a given set of TestKit instances.
 *
 * @param testKitsMap - Map of TestKit name to instance
 * @returns Map of TestKit name to instance of all implied dependencies
 */
export function collectImplicitDependenciesDeep(
  testKitsMap: Record<string, TestKit>,
): Record<string, TestKit> {
  return collectImpliedDependenciesDeepHelper({
    testKits: Object.values(testKitsMap),
    providedTestKitsInstances: testKitsMap,
  });
}

/**
 * Helper recursive function that collects all implied dependencies for a given set of TestKit instances.
 *
 * @param testKits - Array of TestKit instances to analyze
 * @param impliedTestKitsInstances - Map of TestKit name to instance for dependency resolution
 * @param providedTestKitsInstances - Map of TestKit name to instance for dependency resolution
 * @param visited - Set of already visited TestKit names (internal optimization)
 * @returns Flattened array of all unique TestKits including transitive dependencies
 */
function collectImpliedDependenciesDeepHelper({
  testKits,
  providedTestKitsInstances,
  visited = new Set(),
  impliedTestKitsInstances = {},
}: {
  testKits: TestKit[];
  providedTestKitsInstances?: Record<string, TestKit>;
  impliedTestKitsInstances?: Record<string, TestKit>;
  visited?: Set<string>;
}): Record<string, TestKit> {
  for (const testKit of testKits) {
    // Skip if we've already processed this TestKit
    if (visited.has(testKit.name)) {
      continue;
    }

    // Mark as visited before processing to prevent cycles
    visited.add(testKit.name);

    // Get dependency classes from the TestKit
    const dependencyClasses = testKit.dependentTestKitClasses;

    if (!dependencyClasses?.length) {
      continue;
    }

    const dependencyInstances: TestKit[] = [];
    for (const DependencyClass of dependencyClasses) {
      // Try to find existing instance by class name
      const className = DependencyClass.name;
      const existingInstance =
        providedTestKitsInstances?.[className] || impliedTestKitsInstances?.[className];

      if (!existingInstance) {
        const newInstance = new (DependencyClass as new () => TestKit)();

        dependencyInstances.push(newInstance);
        impliedTestKitsInstances[className] = newInstance;
      } else {
        dependencyInstances.push(existingInstance);
      }
    }

    collectImpliedDependenciesDeepHelper({
      testKits: dependencyInstances,
      providedTestKitsInstances,
      impliedTestKitsInstances,
      visited,
    });
  }

  return impliedTestKitsInstances;
}
