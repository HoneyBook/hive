// Deliberately has no *_BASE_KITS export in this file — mirrors
// createReactTestRunnerWithQueries, which inlines its kit array with no
// named export. Must produce no runner entry.
export function createFixtureRunnerNoBaseKits(): { ok: true } {
  return { ok: true };
}
