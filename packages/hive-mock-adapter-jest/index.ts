// The root entry is deliberately free of Node built-ins.
//
// `MockAdapter` is imported by mock adapter files, which are in turn reachable from
// application code (a test kit, a harness, a `__mocks__` twin re-exported through a
// package barrel). If this entry pulled in anything importing `node:fs` / `node:path`,
// every bundler that followed that chain would fail — rspack and webpack reject the
// `node:` scheme for browser targets outright.
//
// The `__mocks__` resolvers legitimately need those built-ins, so they live behind the
// `./resolvers` subpath instead. Jest config is CJS and loads them at config time, where
// Node built-ins are exactly right; nothing a bundler walks can reach them from here.
export { MockAdapter } from "./src/MockAdapter.js";
export { cleanupMockAdapters } from "@honeybook/hive-mock-adapter";
export type { IMockAdapter, CleanupMode } from "@honeybook/hive-mock-adapter";
