import { Node, type CompilerOptions, type ExportedDeclarations, type SourceFile } from "ts-morph";
import { resolveSourceFilePath } from "./resolveSourceFilePath";
import type { RunnerEntry, SourceFilePathMode } from "./types";

/** Peels an optional `as const` wrapper to reach the array literal, if any. */
function getArrayElementNames(initializer: Node): string[] {
  const expr = Node.isAsExpression(initializer) ? initializer.getExpression() : initializer;
  if (!Node.isArrayLiteralExpression(expr)) {
    return [];
  }
  return expr.getElements().map((element) => element.getText());
}

function isFactoryDeclaration(declaration: ExportedDeclarations): boolean {
  if (Node.isFunctionDeclaration(declaration)) {
    return true;
  }
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    return (
      initializer != null &&
      (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    );
  }
  return false;
}

interface FileCandidates {
  baseKitsName?: string;
  baseKitsInitializer?: Node;
  factories: string[];
}

/**
 * Detects each runner factory's forced base kits via the `*_BASE_KITS`
 * const-array export convention (EXPRESS_BASE_KITS, TEMPORAL_BASE_KITS,
 * REACT_BASE_KITS) — never by statically analyzing the factory function
 * body. A factory with no same-file `*_BASE_KITS` export (e.g.
 * createReactTestRunnerWithQueries, which inlines its kit array with no
 * named export) produces no runner entry — this is the locked contract,
 * not a bug to work around.
 */
export function detectRunners(
  sourceFile: SourceFile,
  packageDir: string,
  sourceFilePathMode: SourceFilePathMode,
  compilerOptions: CompilerOptions,
): RunnerEntry[] {
  const byFile = new Map<string, FileCandidates>();

  for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
    for (const declaration of declarations) {
      const filePath = declaration.getSourceFile().getFilePath();
      const candidates = byFile.get(filePath) ?? { factories: [] };

      if (name.endsWith("_BASE_KITS") && Node.isVariableDeclaration(declaration)) {
        candidates.baseKitsName = name;
        candidates.baseKitsInitializer = declaration.getInitializer();
      } else if (isFactoryDeclaration(declaration)) {
        if (!candidates.factories.includes(name)) {
          candidates.factories.push(name);
        }
      }

      byFile.set(filePath, candidates);
    }
  }

  const runners: RunnerEntry[] = [];
  for (const [filePath, candidates] of byFile) {
    if (!candidates.baseKitsInitializer || candidates.factories.length !== 1) {
      continue;
    }
    runners.push({
      factoryName: candidates.factories[0],
      sourceFile: resolveSourceFilePath(sourceFilePathMode, packageDir, compilerOptions, filePath),
      forcedBaseKits: getArrayElementNames(candidates.baseKitsInitializer),
    });
  }

  return runners.sort((a, b) => a.factoryName.localeCompare(b.factoryName));
}
