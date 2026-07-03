import js from "@eslint/js";
import tseslint from "typescript-eslint";
import requireFutureBlockCapture from "./eslint/rules/require-future-block-capture.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "drizzle/**",
      "eslint.config.js",
      "eslint/rules/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      local: {
        rules: {
          "require-future-block-capture": requireFutureBlockCapture,
        },
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "eslint/rules/require-future-block-capture.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow both `type` and `interface` — types for data shapes, interfaces for contracts
      "@typescript-eslint/consistent-type-definitions": "off",
      // Use cases are classes by Clean Architecture convention (Command pattern)
      "@typescript-eslint/no-extraneous-class": "off",
      // Test mocks use no-op functions: async () => {}
      "@typescript-eslint/no-empty-function": "off",
      "local/require-future-block-capture": "error",
    },
  },
  {
    // Fastify route/hook handlers must be async; test mocks implement async interfaces synchronously
    files: [
      "src/api/Server.ts",
      "src/api/routes/**/*.ts",
      "src/api/middleware/**/*.ts",
      "src/**/*.test.ts",
      "test/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
);
