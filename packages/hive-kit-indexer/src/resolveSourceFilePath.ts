import path from "node:path";
import type { CompilerOptions } from "ts-morph";
import type { SourceFilePathMode } from "./types";

/**
 * ts-morph's getCompilerOptions() normalizes rootDir/outDir to absolute
 * paths in this repo's ts-morph version, but defend against a relative
 * value anyway (e.g. a differently-configured tsconfig) by resolving
 * against `base` when the value isn't already absolute.
 */
function resolveAgainst(base: string, maybeRelative: string | undefined, fallback: string): string {
  if (!maybeRelative) {
    return fallback;
  }
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(base, maybeRelative);
}

/**
 * Computes the `sourceFile` field emitted for a kit or runner entry.
 *
 * - "dist" (default): maps the on-disk .ts file to its compiled .js output
 *   path, driven by the target package's actual tsconfig `rootDir`/`outDir`
 *   (read via the ts-morph Project's getCompilerOptions()) rather than
 *   hardcoding rootDir="." / outDir="dist". For hive's own packages, whose
 *   tsconfig actually has rootDir "." and outDir "dist", this reproduces
 *   the pre-existing hardcoded output byte-for-byte (e.g.
 *   `src/Foo.test-kit.ts` -> `dist/src/Foo.test-kit.js`). For a package
 *   with rootDir "src" (e.g. atlas-service), the rootDir segment is
 *   correctly stripped instead of being duplicated under dist/
 *   (`src/Foo.test-kit.ts` -> `dist/Foo.test-kit.js`, not
 *   `dist/src/Foo.test-kit.js`).
 * - "source": returns the raw path relative to packageDir, untransformed —
 *   `.ts`/`.tsx` extension kept as-is, no dist/ prefix. Intended for
 *   live/unbuilt source trees (e.g. a service consumed directly from
 *   source rather than as an installed npm package).
 */
export function resolveSourceFilePath(
  mode: SourceFilePathMode,
  packageDir: string,
  compilerOptions: CompilerOptions,
  absoluteTsFilePath: string,
): string {
  if (mode === "source") {
    return path.relative(packageDir, absoluteTsFilePath).split(path.sep).join("/");
  }

  const rootDir = resolveAgainst(packageDir, compilerOptions.rootDir, packageDir);
  const outDir = resolveAgainst(packageDir, compilerOptions.outDir, path.join(packageDir, "dist"));

  const relFromRoot = path.relative(rootDir, absoluteTsFilePath);
  const jsRel = relFromRoot.replace(/\.tsx?$/, ".js");
  const absOutputPath = path.join(outDir, jsRel);

  return path.relative(packageDir, absOutputPath).split(path.sep).join("/");
}
