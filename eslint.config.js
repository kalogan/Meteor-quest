import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Architecture guard: the deterministic core (`@meteor/shared`, `@meteor/sim-core`)
 * must stay engine-agnostic. It may NOT import any rendering/runtime stack
 * (three, react, R3F) nor reach for wall-clock / global randomness — determinism
 * is enforced by injecting clock + RNG. The client is free to use all of it.
 */
const engineAgnostic = {
  files: ["packages/shared/src/**/*.ts", "packages/sim-core/src/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["three", "three/*", "react", "react/*", "react-dom", "@react-three/*"],
            message:
              "Core (shared/sim-core) is engine-agnostic. Move rendering code into @meteor/client.",
          },
        ],
      },
    ],
    // Determinism: forbid the specific non-deterministic calls (Math.random,
    // Date.now, new Date) while still allowing Math.floor/imul/PI etc.
    "no-restricted-properties": [
      "error",
      { object: "Date", property: "now", message: "Core is deterministic: use the injected Clock, not Date.now." },
      { object: "Math", property: "random", message: "Use the injected RNG, not Math.random." },
    ],
    "no-restricted-syntax": [
      "error",
      { selector: "NewExpression[callee.name='Date']", message: "Core is deterministic: use the injected Clock, not new Date()." },
    ],
  },
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/dist-preview/**", "**/node_modules/**", "**/*.config.*", "**/*.cjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  engineAgnostic,
  {
    // Tests may use whatever they need.
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },
);
