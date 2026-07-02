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
