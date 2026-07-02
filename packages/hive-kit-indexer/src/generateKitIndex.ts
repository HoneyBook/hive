import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import { detectKits } from "./detectKits";
import { detectRunners } from "./detectRunners";
import type { KitIndex, KitIndexOptions } from "./types";

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
 */
export function generateKitIndex(packageDir: string, options?: KitIndexOptions): KitIndex {
  const sourceFilePathMode = options?.sourceFilePathMode ?? "dist";
  const absPackageDir = path.resolve(packageDir);

  const packageJsonPath = path.join(absPackageDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { name: string };

  const tsConfigFilePath = path.join(absPackageDir, "tsconfig.json");
  const project = new Project({ tsConfigFilePath });
  const compilerOptions = project.getCompilerOptions();
  const entrySourceFile = project.getSourceFileOrThrow(path.join(absPackageDir, "index.ts"));

  return {
    package: packageJson.name,
    kits: detectKits(entrySourceFile, absPackageDir, sourceFilePathMode, compilerOptions),
    runners: detectRunners(entrySourceFile, absPackageDir, sourceFilePathMode, compilerOptions),
  };
}
