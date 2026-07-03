import { CxKit } from "../kits/CxKit.test-kit";
import { mergeTestKits } from "../_shim/primitives";
import { createHbTestRunner } from "./hbBase.test-runner";

export const MERGE_HELPER_BASE_KITS = [CxKit] as const;

// Reproduces atlas's createServiceTestRunner.test-runner.ts shape: base
// kits declared at module scope, combined with the caller's extraKits via
// hive's mergeTestKits helper (not an inline array literal), then passed
// into the wrapped call.
export function createMergeHelperTestRunner(extraKits: unknown[]): unknown {
  const kits = mergeTestKits(MERGE_HELPER_BASE_KITS, extraKits);
  return createHbTestRunner(kits);
}
