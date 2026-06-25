import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";
import json from "@eslint/json";

export default [
  // Generated; not worth linting.
  { ignores: ["package-lock.json"] },

  // JavaScript: standalone files plus the inline <script> blocks in index.html,
  // which eslint-plugin-html extracts and lints.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.html"],
    ...js.configs.recommended,
  },
  {
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Empty catch blocks are intentional: localStorage access throws in some
      // privacy modes, and the guard simply falls back to the default theme.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // The caught error binding in those guards is deliberately unused.
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },

  // JSON config/data files (duplicate keys, unsafe values, etc.).
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    rules: json.configs.recommended.rules,
  },
  // JSONC allows comments; allowTrailingCommas matches what Prettier writes
  // (e.g. the markdownlint config).
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    languageOptions: { allowTrailingCommas: true },
    rules: json.configs.recommended.rules,
  },
];
