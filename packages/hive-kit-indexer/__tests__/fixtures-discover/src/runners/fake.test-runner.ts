// Naming false positive — looks like a runner factory (create*TestRunner)
// but wraps nothing; returns a plain object literal with no call at all.
// Must not be misdetected as composed, and must not appear in runners[]
// at all — mirrors DummyFlowPaymentWrapper.test-app-runner.tsx's role as a
// naming-convention trap.
export function createFakeTestRunner(): { kits: unknown[] } {
  return { kits: [] };
}
