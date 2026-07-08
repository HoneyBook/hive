import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import { detectKits } from "./detectKits.js";
import { detectRunners } from "./detectRunners.js";
import { discoverSourceFiles } from "./discoverSourceFiles.js";
import type { KitIndex, KitIndexOptions } from "./types.js";

/**
 * Generates the kit-index for a single package directory.
 *
 * Constructs one ts-morph Project per call, scoped to `packageDir`'s own
 * tsconfig.json — never a shared monorepo-wide project. Sharing one Project
 * across packages would let cross-package path aliasing resolve the wrong
 * TestKit base class.
 *
 * `options.sourceFilePathMode` defaults to "dist" — existing callers (the
 * CLI, wired into hive-express/temporal/react's build scripts) see zero
 * behavior change. "source" is for direct importable-API callers against
 * live/unbuilt source trees.
 *
 * `options.discover`, when provided, replaces (not merges with) the
 * `index.ts`-export scan below: source files are found by glob instead of
 * a single package entry point, and every glob-matched class/factory is
 * indexed regardless of export status. `discover` and `sourceFilePathMode`
 * are orthogonal — discover controls file *discovery*, sourceFilePathMode
 * controls how a found file's path is *written* into `sourceFile`. The
 * non-discover branch below is byte-identical to the tool's original
 * single-entry-point behavior; discover mode never runs through it.
 */
export function generateKitIndex(packageDir: string, options?: KitIndexOptions): KitIndex {
  const sourceFilePathMode = options?.sourceFilePathMode ?? "dist";
  const absPackageDir = path.resolve(packageDir);

  const packageJsonPath = path.join(absPackageDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { name: string };

  const tsConfigFilePath = path.join(absPackageDir, "tsconfig.json");

  if (options?.discover) {
    // `skipAddingFilesFromTsConfig` is the crux of discover mode: the
    // tsconfig still supplies compilerOptions (module resolution,
    // rootDir/outDir, path aliases) but never determines file membership —
    // that's resolved by discoverSourceFiles' globs instead.
    const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true });
    const compilerOptions = project.getCompilerOptions();
    const discovered = discoverSourceFiles(project, absPackageDir, options.discover);

    return {
      package: packageJson.name,
      kits: detectKits(discovered, "all", absPackageDir, sourceFilePathMode, compilerOptions),
      runners: detectRunners(discovered, "all", absPackageDir, sourceFilePathMode, compilerOptions),
    };
  }

  const project = new Project({ tsConfigFilePath });
  const compilerOptions = project.getCompilerOptions();
  const entrySourceFile = project.getSourceFileOrThrow(path.join(absPackageDir, "index.ts"));

  return {
    package: packageJson.name,
    kits: detectKits(
      [entrySourceFile],
      "exports",
      absPackageDir,
      sourceFilePathMode,
      compilerOptions,
    ),
    runners: detectRunners(
      [entrySourceFile],
      "exports",
      absPackageDir,
      sourceFilePathMode,
      compilerOptions,
    ),
  };
}
