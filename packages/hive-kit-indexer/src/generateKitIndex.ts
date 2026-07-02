import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import { detectKits } from "./detectKits";
import { detectRunners } from "./detectRunners";
import type { KitIndex } from "./types";

/**
 * Generates the kit-index for a single package directory.
 *
 * Constructs one ts-morph Project per call, scoped to `packageDir`'s own
 * tsconfig.json — never a shared monorepo-wide project. Sharing one Project
 * across packages would let cross-package path aliasing resolve the wrong
 * TestKit base class.
 */
export function generateKitIndex(packageDir: string): KitIndex {
  const absPackageDir = path.resolve(packageDir);

  const packageJsonPath = path.join(absPackageDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { name: string };

  const tsConfigFilePath = path.join(absPackageDir, "tsconfig.json");
  const project = new Project({ tsConfigFilePath });
  const entrySourceFile = project.getSourceFileOrThrow(path.join(absPackageDir, "index.ts"));

  return {
    package: packageJson.name,
    kits: detectKits(entrySourceFile, absPackageDir),
    runners: detectRunners(entrySourceFile, absPackageDir),
  };
}
