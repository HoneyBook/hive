import path from "node:path";
import { generateKitIndex } from "../src/generateKitIndex";
import type { KitEntry, RunnerEntry } from "../src/types";

const FIXTURE_DIR = path.join(__dirname, "fixtures");
const FIXTURE_ROOT_SRC_DIR = path.join(__dirname, "fixtures-root-src");
const FIXTURE_DISCOVER_DIR = path.join(__dirname, "fixtures-discover");
const FIXTURE_CYCLE_DIR = path.join(__dirname, "fixtures-cycle");

describe("generateKitIndex", () => {
  const index = generateKitIndex(FIXTURE_DIR);

  function getKit(className: string): KitEntry {
    const kit = index.kits.find((k) => k.className === className);
    if (!kit) {
      throw new Error(`Expected kit ${className} to be present, got: ${JSON.stringify(index)}`);
    }
    return kit;
  }

  it("reads the package name from package.json", () => {
    expect(index.package).toBe("@honeybook/hive-kit-indexer-fixture");
  });

  it("does not flag a plain interface as a kit, even with 'TestKit' in its name", () => {
    expect(index.kits.some((k) => k.className === "IFixtureTestKit")).toBe(false);
  });

  it("excludes non-with*-prefixed methods (mirrors seedRenderResult exclusion)", () => {
    const emptyKit = getKit("EmptyMethodsKit");
    expect(emptyKit.methods).toEqual([]);
  });

  it("still emits a full entry for a kit with zero with* methods — never omits it", () => {
    const emptyKit = getKit("EmptyMethodsKit");
    expect(emptyKit.methods).toEqual([]);
    expect(emptyKit.result).toEqual([{ field: "seeded", type: "boolean" }]);
  });

  it("classifies withXError-shaped names as errorInjector via the name-pattern heuristic", () => {
    const seederKit = getKit("SeederKit");
    const withValueError = seederKit.methods.find((m) => m.name === "withValueError");
    expect(withValueError?.kind).toBe("errorInjector");
  });

  it("classifies a plain with* method as seeder by default", () => {
    const seederKit = getKit("SeederKit");
    const withValue = seederKit.methods.find((m) => m.name === "withValue");
    expect(withValue?.kind).toBe("seeder");
    expect(withValue?.jsDoc).toBe("Seeds the value under test.");
  });

  it("an explicit @kind JSDoc tag wins over the name-pattern heuristic", () => {
    const seederKit = getKit("SeederKit");
    // Name matches the errorInjector pattern, but @kind seeder must win.
    const withComputedError = seederKit.methods.find((m) => m.name === "withComputedError");
    expect(withComputedError?.kind).toBe("seeder");
  });

  it("enumerates a package-local result interface's properties", () => {
    const seederKit = getKit("SeederKit");
    expect(seederKit.result).toEqual(
      expect.arrayContaining([
        { field: "value", type: "string" },
        { field: "errorMessage", type: "string | undefined" },
      ]),
    );
    expect(seederKit.result).toHaveLength(2);
  });

  it("collapses an external result type to a single 'result' field", () => {
    const externalKit = getKit("ExternalResultKit");
    expect(externalKit.result).toEqual([{ field: "result", type: "Date" }]);
  });

  it("emits a dist-path sourceFile for kits", () => {
    const seederKit = getKit("SeederKit");
    expect(seederKit.sourceFile).toBe("dist/src/SeederKit.test-kit.js");
  });

  it("detects a runner's forced base kits via its *_BASE_KITS export", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createFixtureTestRunner",
    );
    expect(runner).toBeDefined();
    expect(runner?.forcedBaseKits).toEqual(["SeederKit"]);
    expect(runner?.sourceFile).toBe("dist/src/exampleRunner.test-runner.js");
  });

  it("omits a factory with no same-file *_BASE_KITS export", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createFixtureRunnerNoBaseKits",
    );
    expect(runner).toBeUndefined();
  });
});

describe("generateKitIndex with sourceFilePathMode: 'source'", () => {
  const index = generateKitIndex(FIXTURE_DIR, { sourceFilePathMode: "source" });

  it("emits the raw source path for a kit, untransformed", () => {
    const seederKit = index.kits.find((k) => k.className === "SeederKit");
    expect(seederKit?.sourceFile).toBe("src/SeederKit.test-kit.ts");
  });

  it("emits the raw source path for a runner, untransformed", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createFixtureTestRunner",
    );
    expect(runner?.sourceFile).toBe("src/exampleRunner.test-runner.ts");
  });
});

describe("generateKitIndex against a package with rootDir 'src' (default 'dist' mode)", () => {
  const index = generateKitIndex(FIXTURE_ROOT_SRC_DIR);

  it("does not duplicate the src/ segment under dist/ (regression for the T-10a hardcoded-dist bug)", () => {
    const kit = index.kits.find((k) => k.className === "RootSrcKit");
    expect(kit?.sourceFile).toBe("dist/RootSrcKit.test-kit.js");
  });

  it("applies the same rootDir-aware mapping to runner sourceFile paths", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createRootSrcTestRunner",
    );
    expect(runner?.sourceFile).toBe("dist/rootSrcRunner.test-runner.js");
  });
});

describe("generateKitIndex discover mode", () => {
  const index = generateKitIndex(FIXTURE_DISCOVER_DIR, {
    discover: { include: ["src/**/*.ts"], exclude: ["src/_shim/**", "src/legacy/**"] },
    sourceFilePathMode: "source",
  });

  it("indexes a scattered, unexported kit outside the tsconfig include array", () => {
    expect(index.kits.some((k: KitEntry) => k.className === "ScatteredKit")).toBe(true);
  });

  it("accumulates a 3-layer composed runner's forced base kits base-first", () => {
    const runner = index.runners.find((r: RunnerEntry) => r.factoryName === "createFlowTestRunner");
    expect(runner?.forcedBaseKits).toEqual(["CoreKitA", "CoreKitB", "CxKit", "FlowKit"]);
  });

  it("accumulates a 2-layer composed runner's forced base kits base-first", () => {
    const runner = index.runners.find((r: RunnerEntry) => r.factoryName === "createCxTestRunner");
    expect(runner?.forcedBaseKits).toEqual(["CoreKitA", "CoreKitB", "CxKit"]);
  });

  it("excludes a naming false positive that wraps nothing", () => {
    expect(index.runners.some((r: RunnerEntry) => r.factoryName === "createFakeTestRunner")).toBe(
      false,
    );
  });

  it("excludes a real runner whose file is glob-excluded", () => {
    expect(index.runners.some((r: RunnerEntry) => r.factoryName === "createLegacyTestRunner")).toBe(
      false,
    );
  });

  it("resolves cross-package composition via the wrapped package's published dist/kit-index.json", () => {
    const runner = index.runners.find((r: RunnerEntry) => r.factoryName === "createXpkgTestRunner");
    expect(runner?.forcedBaseKits).toEqual(["WrappedKitX", "WrappedKitY", "LocalKit"]);
  });

  it("resolves cross-package composition through an aliased wrapped-factory import", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createAliasedXpkgTestRunner",
    );
    expect(runner?.forcedBaseKits).toEqual(["WrappedKitX", "WrappedKitY", "LocalKit"]);
  });

  it("sees kits routed through mergeTestKits, not just inline array literals", () => {
    const runner = index.runners.find(
      (r: RunnerEntry) => r.factoryName === "createMergeHelperTestRunner",
    );
    expect(runner?.forcedBaseKits).toEqual(["CoreKitA", "CoreKitB", "CxKit"]);
  });
});

it("throws on zero glob match", () => {
  expect(() =>
    generateKitIndex(FIXTURE_DISCOVER_DIR, { discover: { include: ["no-such-dir/**/*.ts"] } }),
  ).toThrow();
});

describe("composition cycle", () => {
  it("throws instead of infinitely recursing", () => {
    expect(() =>
      generateKitIndex(FIXTURE_CYCLE_DIR, { discover: { include: ["src/**/*.ts"] } }),
    ).toThrow(/cycle|depth/i);
  });
});
