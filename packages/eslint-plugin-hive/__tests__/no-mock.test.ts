import { RuleTester } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import rule, { RULE_NAME } from "../src/rules/no-mock";

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser as unknown as never,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
});

tester.run(RULE_NAME, rule as unknown as never, {
  valid: [
    // Local variable named jest/vi — still flagged by name per spec; these
    // valid cases are unrelated member calls and identifiers.
    { code: `jest.fn();` },
    { code: `vi.fn();` },
    { code: `jest.spyOn(obj, 'm');` },
    { code: `foo.mock('x');` },
    { code: `mock('x');` },
    { code: `const jest = { notMock() {} }; jest.notMock();` },
  ],
  invalid: [
    { code: `jest.mock('./mod');`, errors: [{ messageId: "noMock" }] },
    { code: `vi.mock('./mod');`, errors: [{ messageId: "noMock" }] },
    {
      code: `jest.mock('./mod', () => ({ default: {} }));`,
      errors: [{ messageId: "noMock" }],
    },
    { code: `vi.mock('./mod', factory);`, errors: [{ messageId: "noMock" }] },
  ],
});
