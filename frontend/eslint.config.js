import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: ["dist/", "coverage/", "node_modules/"],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  // Classic hook rules only; the v7 compiler rules (immutability,
  // set-state-in-effect, ...) require refactors tracked separately.
  reactHooks.configs.flat.recommended,
  prettier,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // JSX transform is automatic in Vite; prop validation is TypeScript's job.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // v7 compiler rules require refactors beyond this pass.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/globals": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: ["src/test/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
