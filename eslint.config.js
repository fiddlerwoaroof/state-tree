import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2015,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es6,
      },
    },
    rules: {
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      semi: ["error", "always"],
    },
  },
];
