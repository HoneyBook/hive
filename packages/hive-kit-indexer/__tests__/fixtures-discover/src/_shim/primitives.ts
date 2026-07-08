// Importable base primitive standing in for @honeybook/hive-runner's
// createBaseTestRunner. Excluded from discovery via `discover.exclude` —
// it must never itself be indexed as a runner factory.
export function createBaseTestRunner(kits: unknown, ...rest: unknown[]): unknown {
  return { kits, rest };
}

// Stand-in for @honeybook/hive's mergeTestKits — same variadic-flatten
// signature. Excluded from discovery for the same reason as above.
export function mergeTestKits(...sources: readonly (readonly unknown[])[]): unknown[] {
  return sources.flat();
}
