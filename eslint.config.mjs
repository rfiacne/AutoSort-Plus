import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.js", "src/**/*.ts"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.xpi", "*.zip"],
  },
]);
