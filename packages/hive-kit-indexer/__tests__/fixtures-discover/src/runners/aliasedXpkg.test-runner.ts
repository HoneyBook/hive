import { createWrappedRunner as createAliasedWrappedRunner } from "@hive-fixture/wrapped";
import { LocalKit } from "../kits/LocalKit.test-kit";

export const ALIASED_XPKG_EXTRA = [LocalKit] as const;

// Same cross-package composition as xpkg.test-runner.ts, but the wrapped
// factory is imported under a local alias — the lookup against the wrapped
// package's own dist/kit-index.json must match its real exported name, not
// this file's local alias text.
export function createAliasedXpkgTestRunner(): unknown {
  return createAliasedWrappedRunner(ALIASED_XPKG_EXTRA);
}
