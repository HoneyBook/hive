// Importable base primitive standing in for @honeybook/hive-runner's
// createBaseTestRunner. Excluded from discovery via `discover.exclude` —
// it must never itself be indexed as a runner factory.
export function createBaseTestRunner(kits: unknown, ...rest: unknown[]): unknown {
  return { kits, rest };
}
