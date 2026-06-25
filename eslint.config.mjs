import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";

// The only JavaScript on the site is the two inline <script> blocks in
// index.html, so eslint-plugin-html extracts and lints those.
export default [
  js.configs.recommended,
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
];
