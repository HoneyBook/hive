import fs from "node:fs";
import path from "node:path";
import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type NewExpression,
  type SourceFile,
} from "ts-morph";
import { isTestKitClass } from "./detectKits";
import type { KitIndex } from "./types";

/**
 * Resolves the declarations behind a node's symbol, following an import
 * alias to the actual target declaration (e.g. an imported class binding's
 * own symbol resolves to an `ImportSpecifier`, not the `ClassDeclaration`
 * it re-exports/imports — `getAliasedSymbol()` is required to reach it).
 */
function resolveDeclarations(node: Node): Node[] {
  const symbol = node.getSymbol();
  if (!symbol) {
    return [];
  }
  const resolved = symbol.getAliasedSymbol() ?? symbol;
  return resolved.getDeclarations();
}

/**
 * Runner-factory primitives that terminate a composition chain: calling one
 * of these means the current factory is not itself wrapping another
 * same-repo/cross-package runner factory — it's the base layer.
 */
export const BASE_RUNNER_FACTORY_NAMES = new Set(["createBaseTestRunner", "createAppRunner"]);

type FactoryDeclaration = FunctionDeclaration | ArrowFunction | FunctionExpression;

function isFunctionLikeAncestor(node: Node): node is FactoryDeclaration {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node)
  );
}

/** Peels parenthesized/`as`/non-null wrappers and `x ?? []` down to `x`. */
function unwrapExpr(node: Node): Node {
  let current = node;
  for (;;) {
    if (Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
      continue;
    }
    if (Node.isAsExpression(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    if (Node.isBinaryExpression(current) && current.getOperatorToken().getText() === "??") {
      current = current.getLeft();
      continue;
    }
    break;
  }
  return current;
}

function addUnique(name: string | undefined, out: string[], seen: Set<string>): void {
  if (!name || seen.has(name)) {
    return;
  }
  seen.add(name);
  out.push(name);
}

/**
 * Resolves an identifier/property-access reference to a concrete kit
 * addition: a TestKit/AsyncTestKit class name, or (recursively) a kit-const
 * array initializer (e.g. `const CX_EXTRA_KITS = [CxKit] as const`). Param
 * names are pass-through slots and contribute nothing — callers supply
 * those, they aren't "forced".
 */
function expandReference(
  node: Node,
  paramNames: Set<string>,
  out: string[],
  seen: Set<string>,
): void {
  if (Node.isIdentifier(node) && paramNames.has(node.getText())) {
    return;
  }
  const declarations = resolveDeclarations(node);
  for (const decl of declarations) {
    if (Node.isClassDeclaration(decl) && isTestKitClass(decl)) {
      addUnique(decl.getName(), out, seen);
      return;
    }
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();
      if (init) {
        const unwrapped = unwrapExpr(init);
        if (Node.isArrayLiteralExpression(unwrapped)) {
          expandKitExpression(unwrapped, paramNames, out, seen);
          return;
        }
        if (Node.isCallExpression(unwrapped) && isKnownMergeHelperCall(unwrapped)) {
          for (const arg of unwrapped.getArguments()) {
            expandKitExpression(arg, paramNames, out, seen);
          }
          return;
        }
      }
    }
  }
}

/**
 * Expands an expression (array literal, spread, identifier, property
 * access, `x ?? []`) into the concrete kit-class names it forces. Anything
 * that isn't a recognizable kit reference (booleans, plain object/config
 * literals, method holders) contributes nothing.
 */
function expandKitExpression(
  expr: Node,
  paramNames: Set<string>,
  out: string[],
  seen: Set<string>,
): void {
  const unwrapped = unwrapExpr(expr);

  if (Node.isArrayLiteralExpression(unwrapped)) {
    for (const element of unwrapped.getElements()) {
      if (Node.isSpreadElement(element)) {
        expandKitExpression(element.getExpression(), paramNames, out, seen);
      } else {
        expandReference(element, paramNames, out, seen);
      }
    }
    return;
  }

  if (Node.isIdentifier(unwrapped) || Node.isPropertyAccessExpression(unwrapped)) {
    expandReference(unwrapped, paramNames, out, seen);
  }
  // Anything else (booleans, object/config literals, method holders) -> nothing.
}

/** Every kit reference discovered in an array literal local to `decl`'s own body (not nested functions). */
function collectOwnBodyKits(decl: FactoryDeclaration, paramNames: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const arrayLiterals = decl
    .getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
    .filter((lit) => lit.getFirstAncestor((a) => isFunctionLikeAncestor(a)) === decl);
  for (const lit of arrayLiterals) {
    expandKitExpression(lit, paramNames, out, seen);
  }
  return out;
}

function flattenCallArgs(call: CallExpression | NewExpression, paramNames: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const arg of call.getArguments()) {
    expandKitExpression(arg, paramNames, out, seen);
  }
  return out;
}

/** Appends items from `additions` onto `base`, preserving `base`'s order and skipping duplicates. */
function dedupeConcat(base: string[], additions: string[]): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const item of additions) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** Finds the return-producing CallExpression/NewExpression of a factory declaration's own body. */
function findTerminalCallOrNew(
  decl: FactoryDeclaration,
): CallExpression | NewExpression | undefined {
  let exprNode: Node | undefined;

  if (Node.isArrowFunction(decl)) {
    const body = decl.getBody();
    if (!Node.isBlock(body)) {
      exprNode = body;
    }
  }

  if (!exprNode) {
    const ownReturns = decl
      .getDescendantsOfKind(SyntaxKind.ReturnStatement)
      .filter((rs) => rs.getFirstAncestor((a) => isFunctionLikeAncestor(a)) === decl);
    exprNode = ownReturns[0]?.getExpression();
  }

  if (!exprNode) {
    return undefined;
  }

  return unwrapToCallOrNew(exprNode);
}

function unwrapToCallOrNew(node: Node): CallExpression | NewExpression | undefined {
  const current = unwrapExpr(node);

  if (Node.isCallExpression(current) || Node.isNewExpression(current)) {
    return current;
  }

  if (Node.isIdentifier(current)) {
    for (const decl of resolveDeclarations(current)) {
      if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init) {
          return unwrapToCallOrNew(init);
        }
      }
    }
  }

  return undefined;
}

function isTestAppRunnerSubclass(classDecl: ClassDeclaration): boolean {
  let current = classDecl.getBaseClass();
  while (current) {
    if (current.getName() === "TestAppRunner") {
      return true;
    }
    current = current.getBaseClass();
  }
  return false;
}

function resolveNewExpressionClass(newExpr: NewExpression): ClassDeclaration | undefined {
  const declarations = resolveDeclarations(newExpr.getExpression());
  return declarations.find((d): d is ClassDeclaration => Node.isClassDeclaration(d));
}

/**
 * If `filePath` resolves through a `node_modules` segment, returns the
 * package name (scope-aware) and the absolute path to that package's root
 * directory — the base for reading its published `dist/kit-index.json`.
 */
function resolvePackageRootFromNodeModulesPath(
  filePath: string,
): { packageName: string; packageRoot: string } | undefined {
  const normalized = filePath.split(path.sep).join("/");
  const marker = "/node_modules/";
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) {
    return undefined;
  }
  const afterMarker = normalized.slice(idx + marker.length);
  const segments = afterMarker.split("/");
  const isScoped = segments[0]?.startsWith("@");
  const consumed = isScoped ? 2 : 1;
  const packageName = segments.slice(0, consumed).join("/");
  const packageRoot = normalized.slice(0, idx + marker.length) + packageName;
  return { packageName, packageRoot };
}

function readWrappedRunnerEntry(
  packageRoot: string,
  factoryName: string,
): { forcedBaseKits: string[] } | undefined {
  const kitIndexPath = path.join(packageRoot, "dist", "kit-index.json");
  if (!fs.existsSync(kitIndexPath)) {
    return undefined;
  }
  const parsed = JSON.parse(fs.readFileSync(kitIndexPath, "utf-8")) as KitIndex;
  return parsed.runners.find((r) => r.factoryName === factoryName);
}

function extractFactoryFromDeclaration(decl: Node): FactoryDeclaration | undefined {
  if (Node.isFunctionDeclaration(decl)) {
    return decl;
  }
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return init;
    }
  }
  return undefined;
}

/**
 * A declaration's own exported name — independent of any local import alias
 * the call site used. Needed because a cross-package wrapped-runner lookup
 * must match the wrapped package's own `dist/kit-index.json`, which is
 * keyed by the factory's real name, not whatever alias the caller imported
 * it under (`import { createTemporalTestRunner as createHiveTemporalTestRunner }`).
 */
function getDeclaredName(decl: Node): string | undefined {
  if (Node.isFunctionDeclaration(decl) || Node.isVariableDeclaration(decl)) {
    return decl.getName();
  }
  return undefined;
}

/**
 * Hive-provided kit-merging primitives whose call arguments should be
 * unwrapped as kit references when they appear as a variable's initializer
 * (e.g. `const kits = mergeTestKits(BASE_KITS, extraKits)`). A fixed
 * allowlist rather than a generic "unwrap any called function's arguments"
 * rule: mergeTestKits's own signature (`(...sources: TestKitClasses[]) =>
 * MergedTestKits`) guarantees every argument IS a kit-classes array, so
 * unwrapping it carries no false-positive risk the way unwrapping an
 * arbitrary unrelated helper call would.
 */
const KNOWN_MERGE_HELPER_NAMES = new Set(["mergeTestKits"]);

function isKnownMergeHelperCall(call: CallExpression): boolean {
  const calleeExpr = call.getExpression();
  if (!Node.isIdentifier(calleeExpr)) {
    return false;
  }
  if (KNOWN_MERGE_HELPER_NAMES.has(calleeExpr.getText())) {
    return true;
  }
  return resolveDeclarations(calleeExpr).some((decl) => {
    const name = getDeclaredName(decl);
    return name !== undefined && KNOWN_MERGE_HELPER_NAMES.has(name);
  });
}

const MAX_COMPOSITION_DEPTH = 10;

function resolve(decl: FactoryDeclaration, depth: number, activePath: Set<Node>): string[] | null {
  if (depth > MAX_COMPOSITION_DEPTH) {
    throw new Error(
      `[hive-kit-indexer] composition recursion exceeded depth ${MAX_COMPOSITION_DEPTH} (cycle?)`,
    );
  }
  if (activePath.has(decl)) {
    throw new Error("[hive-kit-indexer] composition cycle detected");
  }

  activePath.add(decl);
  try {
    const paramNames = new Set(decl.getParameters().map((p) => p.getName()));
    const ownBodyKits = collectOwnBodyKits(decl, paramNames);

    const terminal = findTerminalCallOrNew(decl);
    if (!terminal) {
      return null;
    }

    if (Node.isNewExpression(terminal)) {
      const classDecl = resolveNewExpressionClass(terminal);
      if (classDecl && isTestAppRunnerSubclass(classDecl)) {
        return dedupeConcat(ownBodyKits, flattenCallArgs(terminal, paramNames));
      }
      return ownBodyKits.length > 0 ? ownBodyKits : null;
    }

    const call = terminal;
    const calleeExpr = call.getExpression();
    const calleeName = Node.isIdentifier(calleeExpr) ? calleeExpr.getText() : undefined;

    if (calleeName && BASE_RUNNER_FACTORY_NAMES.has(calleeName)) {
      return dedupeConcat(ownBodyKits, flattenCallArgs(call, paramNames));
    }

    const declarations = resolveDeclarations(calleeExpr);

    for (const decl2 of declarations) {
      const pkgInfo = resolvePackageRootFromNodeModulesPath(decl2.getSourceFile().getFilePath());
      if (!pkgInfo) {
        continue;
      }
      const realName = getDeclaredName(decl2) ?? calleeName;
      if (!realName) {
        continue;
      }
      const wrapped = readWrappedRunnerEntry(pkgInfo.packageRoot, realName);
      if (wrapped) {
        const withOwn = dedupeConcat(wrapped.forcedBaseKits, ownBodyKits);
        return dedupeConcat(withOwn, flattenCallArgs(call, paramNames));
      }
    }

    for (const decl2 of declarations) {
      const factoryDecl = extractFactoryFromDeclaration(decl2);
      if (!factoryDecl) {
        continue;
      }
      const child = resolve(factoryDecl, depth + 1, activePath);
      if (child === null) {
        return null;
      }
      const withOwn = dedupeConcat(child, ownBodyKits);
      return dedupeConcat(withOwn, flattenCallArgs(call, paramNames));
    }

    return ownBodyKits.length > 0 ? ownBodyKits : null;
  } finally {
    activePath.delete(decl);
  }
}

/**
 * Returns the recursively-accumulated `forcedBaseKits` for a factory
 * declaration by walking its terminal call chain, or `null` when `decl`
 * is not actually a runner factory (its terminal expression does not
 * bottom out at a base-runner primitive, a `TestAppRunner` subclass
 * instantiation, or a resolvable same-repo/cross-package runner call).
 */
export function resolveForcedBaseKits(
  decl: FactoryDeclaration,
  packageDir: string,
): string[] | null {
  void packageDir; // node_modules resolution is derived from the callee's own resolved file path
  return resolve(decl, 0, new Set());
}

/** All top-level function/arrow/function-expression factory candidates in a source file, export status ignored. */
export function getAllFactoryCandidates(
  sourceFile: SourceFile,
): { name: string; decl: FactoryDeclaration }[] {
  const results: { name: string; decl: FactoryDeclaration }[] = [];

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name) {
      results.push({ name, decl: fn });
    }
  }

  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const init = varDecl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      results.push({ name: varDecl.getName(), decl: init });
    }
  }

  return results;
}
