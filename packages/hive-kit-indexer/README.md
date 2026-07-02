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
  `*_BASE_KITS` export produces no `runners` entry.
