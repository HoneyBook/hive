import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

export const RULE_NAME = "no-spy-on";

const rule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    docs: {
      description:
        "Bans jest.spyOn() / vi.spyOn(). Use hive's MockAdapter pattern — spies are injected automatically.",
    },
    schema: [],
    messages: {
      noSpyOn:
        "Avoid {{ callName }}. Wrap the class with MockAdapter from @honeybook/hive-mock-adapter-{vitest|jest}; every method is auto-spied, so manual spyOn is unnecessary.",
    },
  },
  defaultOptions: [] as unknown[],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "jest" || callee.object.name === "vi") &&
          callee.property.type === "Identifier" &&
          callee.property.name === "spyOn"
        ) {
          context.report({
            node,
            messageId: "noSpyOn",
            data: { callName: `${callee.object.name}.spyOn()` },
          });
        }
      },
    };
  },
});

export default rule;
