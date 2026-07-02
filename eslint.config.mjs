/**
 * Shared ESLint base configuration for honeybook-hive packages.
 * Universal rules only — no React, jsx-a11y, or jest plugin.
 */
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

const catchAnyMessage =
  "Type the caught error as `unknown` (or omit the annotation — TS infers `unknown` with `useUnknownInCatchVariables`). Narrow with `instanceof` / a type-guard before reading fields.";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: globals.commonjs },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{js,ts,jsx,tsx}"],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
      parser: tseslint.parser,
      globals: {
        ...globals.node,
        ...globals.es6,
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".ts"],
        },
      },
    },
    rules: {
      // Import rules
      "import/prefer-default-export": "off",
      "import/no-named-as-default": "off",
      "import/no-unresolved": "off",
      "import/extensions": "off",
      "import/no-extraneous-dependencies": "off",

      // TypeScript ESLint rules
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-unsafe-declaration-merging": "warn",
      "@typescript-eslint/no-duplicate-enum-values": "warn",
      "@typescript-eslint/no-unnecessary-type-constraint": "warn",
      "@typescript-eslint/no-throw-literal": "off",

      // General rules
      "no-debugger": "warn",
      "no-console": "off",
      "no-return-await": "off",
      "no-plusplus": "off",
      "no-prototype-builtins": "off",
      "no-underscore-dangle": "off",
      "no-use-before-define": "off",
      "arrow-body-style": "off",
      "prefer-object-spread": "off",
      "lines-between-class-members": "off",
      "class-methods-use-this": "off",
      curly: ["error", "all"],
      "no-param-reassign": [
        "error",
        {
          props: false,
        },
      ],

      "prefer-const": "warn",
      "no-extra-boolean-cast": "warn",
      "no-useless-escape": "warn",
      "no-case-declarations": "warn",
      "no-empty-pattern": "warn",
      "no-var": "warn",
      "no-empty": "warn",
      "no-unsafe-optional-chaining": "warn",
      "no-undef": "warn",
      "prefer-rest-params": "warn",
      "no-sparse-arrays": "warn",
      "no-async-promise-executor": "warn",
      "no-constant-binary-expression": "warn",
      "no-useless-catch": "warn",
      "no-constant-condition": "warn",
      "no-fallthrough": "warn",
      "no-duplicate-case": "warn",
      "no-shadow-restricted-names": "warn",
      "no-unsafe-finally": "warn",
      "no-global-assign": "warn",
    },
  },
  {
    // Test files — add jest globals
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ["**/*.{js,ts}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CatchClause > Identifier.param[typeAnnotation.typeAnnotation.type='TSAnyKeyword']",
          message: catchAnyMessage,
        },
      ],
    },
  },
];
