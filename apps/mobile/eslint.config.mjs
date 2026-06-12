import { defineConfig } from "eslint/config";
import expoFlat from "eslint-config-expo/flat.js";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  ...expoFlat,
  {
    rules: {
      "no-console": "warn",
      "prefer-const": "error",
    },
  },
  eslintConfigPrettier,
]);
