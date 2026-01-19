import tsparser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  // TypeScript files configuration with Obsidian rules
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint,
      obsidianmd: obsidianmd,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      // Apply all recommended Obsidian rules
      ...obsidianmd.configs.recommended,
      // Allow "Claude Code" as brand name and UI labels starting with emoji
      "obsidianmd/ui/sentence-case": ["error", {
        brands: ["Claude Code"],
        // Ignore strings starting with emoji (icon + label pattern)
        ignoreRegex: ["^[⚠️📋📄🔧✅❌]"],
      }],
    },
  },

  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "main.js",
      "*.mjs",
      "tests/**",
      "claudedocs/**",
    ],
  },
];
