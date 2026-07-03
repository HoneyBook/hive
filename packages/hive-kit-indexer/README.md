# @honeybook/hive-kit-indexer

Generates `dist/kit-index.json` for a hive package — a manifest of its
`TestKit`/`AsyncTestKit` subclasses, their `with*` methods, and each
runner factory's forced base kits. Built on `ts-morph`.

## API

```ts
import { generateKitIndex } from "@honeybook/hive-kit-indexer";

const index = generateKitIndex("/path/to/packages/hive-express");

// Analyzing a live/unbuilt source tree instead of an installed package —
// e.g. a service with no npm-published dist output — use "source" mode:
const liveIndex = generateKitIndex("/path/to/atlas-service", {
  sourceFilePathMode: "source",
});

// A consuming service whose TestKit subclasses are scattered across
// src/** rather than curated through a barrel index.ts — use `discover`.
// Prefer scoping the glob to the *.test-kit.ts/*.test-runner.ts naming
// convention over a broad src/**/*.ts scan — no reason to walk the whole
// codebase when the convention already marks every file that matters:
const discoveredIndex = generateKitIndex("/path/to/atlas-service", {
  discover: { include: ["src/**/*.test-kit.ts", "src/**/*.test-runner.ts"] },
  sourceFilePathMode: "source",
});
```

`generateKitIndex(packageDir: string, options?: KitIndexOptions): KitIndex`
type-checks the package's public exports (`packageDir/index.ts`) against
`packageDir/tsconfig.json`, using the TypeScript type checker's
heritage-clause resolution — not filename or class-name string matching —
to find concrete classes whose base-class chain includes `TestKit` or
`AsyncTestKit`.

### `KitIndexOptions`

```ts
interface KitIndexOptions {
  sourceFilePathMode?: "dist" | "source"; // default: "dist"
  discover?: { include: string[]; exclude?: string[] };
}
```

- **`"dist"`** (default) — `sourceFile` is a build-output path, derived
  from `packageDir`'s own `tsconfig.json` `rootDir`/`outDir` (not
  hardcoded) — correct regardless of whether a package uses `rootDir: "."`
  (hive's own packages) or `rootDir: "src"` (e.g. atlas-service). Use this
  when the caller consumes an **installed, built package** (the CLI always
  uses this mode).
- **`"source"`** — `sourceFile` is the raw path relative to `packageDir`,
  untransformed (`.ts`/`.tsx` extension kept, no `dist/` prefix). Use this
  when analyzing a **live/unbuilt source tree directly** — e.g. a service
  that isn't consumed as an installed npm package.
- **`discover`** — when provided, **replaces** (not merges with) the
  default `packageDir/index.ts`-export scan: source files are found by
  resolving `include`/`exclude` as globs against `packageDir`, entirely
  independent of the target's own `tsconfig.json` `include` array (the
  tsconfig is still used for type resolution — module resolution,
  `rootDir`/`outDir`, path aliases — just never for file membership).
  Every glob-matched `TestKit`/`AsyncTestKit` class and runner factory is
  indexed regardless of export status. A `discover.include` glob that
  matches zero files throws rather than emitting an empty index.
  `discover` and `sourceFilePathMode` are orthogonal: `discover` controls
  _how files are found_, `sourceFilePathMode` controls _how a found file's
  path is written into `sourceFile`_ — the common pairing for a
  discover-mode consumer is `discover` + `sourceFilePathMode: "source"`,
  but nothing forces it. Prefer scoping `include` to the
  `*.test-kit.ts`/`*.test-runner.ts` naming convention over a broad
  `src/**/*.ts` scan when that convention is already in place — no reason
  to walk the whole source tree when the filenames already mark every
  file that matters.

## CLI

```bash
hive-kit-indexer [packageDir]
```

Run from a package root after that package's own `tsc` build (`dist/`
must already exist). Defaults `packageDir` to `process.cwd()`. Writes
`packageDir/dist/kit-index.json`.

## Emitted schema

```ts
interface KitIndex {
  package: string;
  kits: KitEntry[];
  runners: RunnerEntry[];
}

interface KitEntry {
  className: string;
  sourceFile: string; // dist path, e.g. "dist/src/Foo.test-kit.js"
  methods: MethodEntry[];
  result: ResultField[];
}

interface MethodEntry {
  name: string;
  kind: "seeder" | "errorInjector" | "exposure";
  signature: string;
  jsDoc: string | null;
}

interface ResultField {
  field: string;
  type: string;
}

interface RunnerEntry {
  factoryName: string;
  sourceFile: string;
  forcedBaseKits: string[];
}
```

Load-bearing rules:

- In the default `"dist"` mode, `sourceFile` is the **ESM dist path**
  (`dist/src/*.js`), never the `dist/cjs/*.js` path. In `"source"` mode
  it's the raw `.ts`/`.tsx` path relative to `packageDir` instead — see
  `KitIndexOptions` above.
- Only methods whose name starts with `with` are indexed — this mirrors
  `TestAppRunner.applyTestKitMethodsOnAppRunner`'s own filter, so anything
  else (e.g. `seedRenderResult`) is correctly excluded as non-test-facing.
- `kind` classification: an explicit `@kind` JSDoc tag always wins;
  otherwise `withXError`/`setXError`-shaped names classify as
  `errorInjector`, everything else defaults to `seeder`. `exposure` is
  reachable only via the explicit tag.
- Kits with zero `with*` methods still emit a full entry with
  `methods: []` — they are never omitted.
- `result` fields enumerate a package-local result interface's properties
  when the kit's `result` type resolves to one; otherwise (an external
  type) it collapses to a single `{ field: "result", type: <TypeText> }`.
- Runner detection is anchored on the `*_BASE_KITS` const-array export
  convention in the same source file as the factory — not on statically
  analyzing the factory function body. A factory with no same-file
  `*_BASE_KITS` export produces no `runners` entry. This remains the
  mechanism in the default (non-`discover`) mode.
- **Composition detection** (`discover` mode only): a factory's
  `forcedBaseKits` is resolved by real static call-graph analysis instead
  of the `*_BASE_KITS` convention — it walks the factory body's terminal
  call expression, recursing through same-repo wrapped factories and
  unioning each layer's own unconditionally-added kits (excluding
  caller-supplied pass-through kits) until it bottoms out at a base-runner
  primitive. Recursion is capped at depth 10; a cycle or exceeding the cap
  throws rather than truncating silently. A factory whose terminal call
  doesn't resolve to a recognizable runner primitive/wrap (e.g. a
  `create*TestRunner`-named function that doesn't actually wrap anything)
  produces no `runners` entry — naming alone is never sufficient. Wrapping
  a runner from another package reads that package's already-published
  `node_modules/<pkg>/dist/kit-index.json` rather than re-deriving
  analysis against its source.
