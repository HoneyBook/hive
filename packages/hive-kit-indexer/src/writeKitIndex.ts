import fs from "node:fs";
import path from "node:path";
import { generateKitIndex } from "./generateKitIndex.js";

/**
 * Generates `packageDir`'s kit-index and writes it to `dist/kit-index.json`.
 * Library-level counterpart to the CLI — importable directly so in-repo
 * consumers don't need the `.bin` shim, which pnpm only creates if the bin
 * target file already exists at install time (never true for a workspace
 * package that hasn't built yet).
 */
export function writeKitIndex(packageDir: string = process.cwd()): string {
  const kitIndex = generateKitIndex(packageDir);
  const outPath = path.join(packageDir, "dist", "kit-index.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(kitIndex, null, 2)}\n`);
  return outPath;
}
