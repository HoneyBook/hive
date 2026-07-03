import fs from "node:fs";
import path from "node:path";
import { writeKitIndex } from "../src/writeKitIndex";

const FIXTURE_DIR = path.join(__dirname, "fixtures");
const FIXTURE_DIST_DIR = path.join(FIXTURE_DIR, "dist");

// Calls against FIXTURE_DIR directly (not a copied-out tmp dir) — a fixture
// copied elsewhere loses its node_modules resolution context, so type
// checking the TestKit heritage clause against @honeybook/hive would fail
// silently and every kit/runner would go undetected.
describe("writeKitIndex", () => {
  afterEach(() => {
    fs.rmSync(FIXTURE_DIST_DIR, { recursive: true, force: true });
  });

  it("writes dist/kit-index.json and returns its path", () => {
    const outPath = writeKitIndex(FIXTURE_DIR);
    expect(outPath).toBe(path.join(FIXTURE_DIST_DIR, "kit-index.json"));

    const written = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(written.package).toBe("@honeybook/hive-kit-indexer-fixture");
    expect(written.kits.some((k: { className: string }) => k.className === "SeederKit")).toBe(true);
  });

  it("defaults packageDir to process.cwd()", () => {
    const originalCwd = process.cwd();
    process.chdir(FIXTURE_DIR);

    try {
      const outPath = writeKitIndex();
      expect(fs.existsSync(outPath)).toBe(true);
      expect(path.basename(outPath)).toBe("kit-index.json");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
