// Deliberately re-exports only one kit — the rest are discovered via
// `discover.include` globs directly, without needing a barrel export, and
// even though the tsconfig `include` array above doesn't cover `src/**`.
export { CoreKitA } from "./src/kits/CoreKitA.test-kit";
