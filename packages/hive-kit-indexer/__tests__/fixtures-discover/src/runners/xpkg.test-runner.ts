import { createWrappedRunner } from "@hive-fixture/wrapped";
import { LocalKit } from "../kits/LocalKit.test-kit";

export const XPKG_EXTRA = [LocalKit] as const;

// Wraps a cross-package runner — its forcedBaseKits must be read from the
// wrapped package's already-published dist/kit-index.json, not re-derived
// from source.
export function createXpkgTestRunner(): unknown {
  return createWrappedRunner(XPKG_EXTRA);
}
