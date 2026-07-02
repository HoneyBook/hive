import { TestKit } from "@honeybook/hive";

export interface RootSrcKitResult {
  value: string;
}

/**
 * Regression fixture for a package whose tsconfig has rootDir "src" (e.g.
 * atlas-service's actual shape) rather than hive's own rootDir ".". Proves
 * that resolveSourceFilePath's "dist" mode correctly omits the `src/`
 * segment instead of duplicating it under dist/.
 */
export class RootSrcKit extends TestKit {
  result: RootSrcKitResult = { value: "" };

  get name(): "RootSrcKit" {
    return "RootSrcKit";
  }

  /** Seeds the value under test. */
  withValue(value: string): void {
    this.result.value = value;
  }
}
