import path from "node:path";
import { Node, type ClassDeclaration, type CompilerOptions, type SourceFile } from "ts-morph";
import { classifyMethodKind, getMethodJsDoc } from "./classifyMethod";
import { resolveSourceFilePath } from "./resolveSourceFilePath";
import type { KitEntry, MethodEntry, ResultField, SourceFilePathMode } from "./types";

const KIT_BASE_CLASS_NAMES = new Set(["TestKit", "AsyncTestKit"]);

/**
 * Heritage/type-checker check — walks the resolved base-class chain looking
 * for TestKit or AsyncTestKit. Never string-matches the class's own name or
 * its filename, so an interface like IProviderTestKit (no heritage clause,
 * no class declaration at all) never qualifies.
 *
 * Exported so resolveComposition.ts (discover-mode composition analysis)
 * can reuse the identical base-chain walk instead of duplicating it.
 */
export function isTestKitClass(classDecl: ClassDeclaration): boolean {
  let current = classDecl.getBaseClass();
  while (current) {
    if (KIT_BASE_CLASS_NAMES.has(current.getName() ?? "")) {
      return true;
    }
    current = current.getBaseClass();
  }
  return false;
}

function isDeclaredInsidePackage(packageDir: string, declarationFilePath: string): boolean {
  const rel = path.relative(packageDir, declarationFilePath);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Enumerates instance methods whose name starts with "with" — exactly the
 * filter TestAppRunner.applyTestKitMethodsOnAppRunner applies. Methods like
 * seedRenderResult are intentionally excluded: they are not test-facing API
 * surface bound onto the runner.
 */
function extractMethods(classDecl: ClassDeclaration): MethodEntry[] {
  return classDecl
    .getInstanceMethods()
    .filter((method) => method.getName().startsWith("with"))
    .map((method) => {
      const params = method
        .getParameters()
        .map((param) => param.getText())
        .join(", ");
      // Pass `method` as the context node so the printer uses the type's
      // locally-imported alias (e.g. "Application") instead of a fully
      // qualified `import("/abs/path/...")....` form.
      const returnType = method.getReturnType().getText(method);
      return {
        name: method.getName(),
        kind: classifyMethodKind(method),
        signature: `(${params}): ${returnType}`,
        jsDoc: getMethodJsDoc(method),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolves the kit's `result` field type. If the type's symbol is declared
 * in a package-local interface, enumerate its properties. Otherwise (an
 * external type, e.g. RenderResult from @testing-library/react, or a
 * TypeScript-lib global like Date), collapse to a single `result` field.
 */
function extractResultFields(classDecl: ClassDeclaration, packageDir: string): ResultField[] {
  const resultProp = classDecl.getInstanceProperty("result");
  if (!resultProp) {
    return [];
  }

  const type = resultProp.getType();
  const declarations = type.getSymbol()?.getDeclarations() ?? [];
  const interfaceDecl = declarations.find((decl) => Node.isInterfaceDeclaration(decl));

  if (interfaceDecl && Node.isInterfaceDeclaration(interfaceDecl)) {
    const declFilePath = interfaceDecl.getSourceFile().getFilePath();
    if (isDeclaredInsidePackage(packageDir, declFilePath)) {
      // Pass each property as its own context node — see comment above on
      // extractMethods' getReturnType().getText(method) for why.
      return interfaceDecl.getProperties().map((prop) => ({
        field: prop.getName(),
        type: prop.getType().getText(prop),
      }));
    }
  }

  return [{ field: "result", type: type.getText(resultProp) }];
}

/** Builds the KitEntry for a class already confirmed to be a TestKit/AsyncTestKit subclass. */
function buildKitEntry(
  declaration: ClassDeclaration,
  className: string,
  packageDir: string,
  sourceFilePathMode: SourceFilePathMode,
  compilerOptions: CompilerOptions,
): KitEntry {
  return {
    className,
    sourceFile: resolveSourceFilePath(
      sourceFilePathMode,
      packageDir,
      compilerOptions,
      declaration.getSourceFile().getFilePath(),
    ),
    methods: extractMethods(declaration),
    result: extractResultFields(declaration, packageDir),
  };
}

/**
 * Detects TestKit/AsyncTestKit subclasses across either a single entry
 * `SourceFile` ("exports" mode — the package's curated public API, scanned
 * via getExportedDeclarations() to stay robust to aliased/renamed exports)
 * or a discovered set of `SourceFile`s ("all" mode — every class matching
 * the `discover` glob, regardless of export status).
 *
 * "exports" mode runs the exact byte-identical loop this function has
 * always run — the else-branch of generateKitIndex's zero-config path is
 * untouched by discover mode's existence.
 */
export function detectKits(
  sourceFiles: SourceFile[],
  scanMode: "exports" | "all",
  packageDir: string,
  sourceFilePathMode: SourceFilePathMode,
  compilerOptions: CompilerOptions,
): KitEntry[] {
  const kits: KitEntry[] = [];

  if (scanMode === "exports") {
    const sourceFile = sourceFiles[0];
    for (const declarations of sourceFile.getExportedDeclarations().values()) {
      for (const declaration of declarations) {
        if (!Node.isClassDeclaration(declaration) || !isTestKitClass(declaration)) {
          continue;
        }
        const className = declaration.getName();
        if (!className) {
          continue;
        }
        kits.push(
          buildKitEntry(declaration, className, packageDir, sourceFilePathMode, compilerOptions),
        );
      }
    }
  } else {
    for (const sourceFile of sourceFiles) {
      for (const cls of sourceFile.getClasses()) {
        if (!isTestKitClass(cls)) {
          continue;
        }
        const className = cls.getName();
        if (!className) {
          continue;
        }
        kits.push(buildKitEntry(cls, className, packageDir, sourceFilePathMode, compilerOptions));
      }
    }
  }

  return kits.sort((a, b) => a.className.localeCompare(b.className));
}
