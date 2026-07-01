import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

export const RULE_NAME = "no-mock";

const rule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    docs: {
      description:
        "Bans jest.mock() / vi.mock(). Use hive's MockAdapter pattern instead of raw module mocking.",
    },
    schema: [],
    messages: {
      noMock:
        "Avoid {{ callName }}. Use MockAdapter from @honeybook/hive-mock-adapter-{vitest|jest} to wrap the class under test, and configure mockSubstitutionPlugin (vitest) in your test config to substitute .mock.ts files automatically.",
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
          callee.property.name === "mock"
        ) {
          context.report({
            node,
            messageId: "noMock",
            data: { callName: `${callee.object.name}.mock()` },
          });
        }
      },
    };
  },
});

export default rule;
