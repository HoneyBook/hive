#!/usr/bin/env node
import path from "node:path";
import { writeKitIndex } from "./writeKitIndex.js";

// Runs from the target package's root (pnpm sets script cwd to the package
// root), after that package's own `tsc` build — dist/ already exists.
// process.argv[2] lets it be pointed at another package dir explicitly.
const targetDir = path.resolve(process.argv[2] ?? process.cwd());

const outPath = writeKitIndex(targetDir);

// This is a CLI tool's own stdout output, not application/product code —
// the repo-wide "route through logDebug/logError" rule targets the latter.
// eslint-disable-next-line no-restricted-syntax
console.log(`[hive-kit-indexer] wrote ${outPath}`);
