import type { ESLint, Linter, Rule } from "eslint";
import noMock, { RULE_NAME as NO_MOCK } from "./rules/no-mock";
import noSpyOn, { RULE_NAME as NO_SPY_ON } from "./rules/no-spy-on";

const PLUGIN_NAME = "@honeybook/eslint-plugin-hive";
const VERSION = "0.0.0";

// RuleCreator.withoutDocs returns TSESLint.RuleModule which is not directly
// assignable to eslint's Rule.RuleModule due to contravariant context types.
// The cast is safe — the runtime shape is identical.
const rules: Record<string, Rule.RuleModule> = {
  [NO_MOCK]: noMock as unknown as Rule.RuleModule,
  [NO_SPY_ON]: noSpyOn as unknown as Rule.RuleModule,
};

const plugin: ESLint.Plugin = {
  meta: {
    name: PLUGIN_NAME,
    version: VERSION,
  },
  rules,
};

// Two-pass: attach the recommended flat config after the plugin object exists,
// so the config can reference this same plugin instance under the "hive" key.
const recommended: Linter.Config = {
  plugins: { hive: plugin },
  rules: {
    [`hive/${NO_MOCK}`]: "error",
    [`hive/${NO_SPY_ON}`]: "error",
  },
};

plugin.configs = { recommended };

export default plugin;
