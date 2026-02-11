import globals from "globals";
import pluginJs from "@eslint/js";
import html from "eslint-plugin-html";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "script" },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  {
    files: ["**/*.liquid"],
    plugins: { html },
    settings: {
      "html/html-extensions": [".liquid"],
    },
    rules: {
      "max-len": [
        "error",
        {
          code: 400,
        },
      ],
    },
  },
];
