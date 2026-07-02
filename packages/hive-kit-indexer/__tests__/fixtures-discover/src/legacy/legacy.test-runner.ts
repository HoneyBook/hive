import { CoreKitA } from "../kits/CoreKitA.test-kit";
import { createBaseTestRunner } from "../_shim/primitives";

// A real runner, but its directory is excluded via `discover.exclude` —
// must never appear in the index even though it's a genuine base-primitive
// call, proving exclude globs are honored at the file-discovery level.
export function createLegacyTestRunner(): unknown {
  return createBaseTestRunner([CoreKitA]);
}
