import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import ts from "typescript-eslint";
import { importBoundaries } from "./scripts/eslint-rules";

export default ts.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.svelte-kit/**",
      "**/build/**",
      "**/dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.svelte"],
    extends: [js.configs.recommended, ts.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: [
          "tsconfig.tools.json",
          "apps/api/tsconfig.json",
          "apps/web/tsconfig.json",
          "apps/web/tsconfig.tools.json",
          "packages/contracts/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".svelte"],
      },
    },
    plugins: { project: { rules: { "import-boundaries": importBoundaries } } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "project/import-boundaries": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSAsExpression > TSAsExpression.expression[typeAnnotation.type='TSUnknownKeyword']",
          message:
            "Jangan melewati validasi tipe dengan as unknown as; validasi input dengan schema.",
        },
      ],
    },
  },
  ...svelte.configs.recommended,
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    files: ["apps/**/*.{ts,svelte}", "packages/contracts/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSAsExpression > TSAsExpression.expression[typeAnnotation.type='TSUnknownKeyword']",
          message:
            "Jangan melewati validasi tipe dengan as unknown as; validasi input dengan schema.",
        },
        {
          selector: "ImportExpression[source.type!='Literal']",
          message: "Gunakan import dengan path literal agar batas modul dapat diperiksa.",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: "Gunakan import ESM agar batas modul dapat diperiksa.",
        },
      ],
    },
  },
  prettier,
);
