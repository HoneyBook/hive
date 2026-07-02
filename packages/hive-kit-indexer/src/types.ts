/**
 * Locked schema for kit-index.json. Downstream consumers (e.g. T-10b's
 * skill-ladder generator) import these types directly — changing field
 * names or shapes here is a breaking change for them.
 */

export type MethodKind = "seeder" | "errorInjector" | "exposure";

export interface MethodEntry {
  name: string;
  kind: MethodKind;
  signature: string;
  jsDoc: string | null;
}

export interface ResultField {
  field: string;
  type: string;
}

export interface KitEntry {
  className: string;
  sourceFile: string;
  methods: MethodEntry[];
  result: ResultField[];
}

export interface RunnerEntry {
  factoryName: string;
  sourceFile: string;
  forcedBaseKits: string[];
}

export interface KitIndex {
  package: string;
  kits: KitEntry[];
  runners: RunnerEntry[];
}

/**
 * "dist" (default): sourceFile is a compiled build-output path, derived
 * from the target package's own tsconfig rootDir/outDir. Preserves
 * hive's existing behavior byte-for-byte.
 *
 * "source": sourceFile is the raw path relative to packageDir, untouched —
 * for live/unbuilt source trees (e.g. a future atlas-service consumer of
 * this package as an importable API rather than the CLI).
 */
export type SourceFilePathMode = "dist" | "source";

export interface KitIndexOptions {
  sourceFilePathMode?: SourceFilePathMode;
}
