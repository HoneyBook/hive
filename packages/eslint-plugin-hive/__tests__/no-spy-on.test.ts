import { RuleTester } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import rule, { RULE_NAME } from "../src/rules/no-spy-on";

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
    { code: `jest.fn();` },
    { code: `vi.fn();` },
    { code: `jest.mock('./mod');` },
    { code: `foo.spyOn(obj, 'm');` },
    { code: `spyOn(obj, 'm');` },
  ],
  invalid: [
    { code: `jest.spyOn(obj, 'method');`, errors: [{ messageId: "noSpyOn" }] },
    { code: `vi.spyOn(obj, 'method');`, errors: [{ messageId: "noSpyOn" }] },
    {
      code: `jest.spyOn(service, 'run').mockReturnValue(1);`,
      errors: [{ messageId: "noSpyOn" }],
    },
  ],
});
