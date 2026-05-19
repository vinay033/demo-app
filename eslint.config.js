// @ts-check
// ESLint flat config — ESLint 10 / @angular-eslint 21 / @typescript-eslint 8
//
// Two-tier strictness:
//   Tier 1 (all src/**/*.ts)  — recommended rules, catches obvious mistakes
//   Tier 2 (src/app/telemetry/**/*.ts) — strict, type-aware rules; errors block CI
//
// Run:  npm run lint
// Docs: docs/static-analysis.md

const tsParser  = require('@typescript-eslint/parser');
const tsPlugin  = require('@typescript-eslint/eslint-plugin');
const ngPlugin  = require('@angular-eslint/eslint-plugin');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ── Ignored paths ───────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.js',
      '*.mjs',
      '*.cjs',
      'scripts/**',
      'karma.conf.js',
    ],
  },

  // ── Tier 1: baseline for all TypeScript source ──────────────────────────
  {
    files: ['src/**/*.ts', 'projects/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': ngPlugin,
    },
    rules: {
      // TypeScript safety (type-unaware — fast, no project required)
      '@typescript-eslint/no-explicit-any':    'warn',
      '@typescript-eslint/no-unused-vars':     ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/ban-ts-comment':     'error',

      // Angular lifecycle correctness
      '@angular-eslint/contextual-lifecycle':      'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@angular-eslint/use-lifecycle-interface':   'warn',
      // Angular 14 uses constructor injection by convention; inject() is Angular 16+
      // style. Warn so adopters notice it without blocking CI on legacy code.
      '@angular-eslint/prefer-inject':             'warn',
    },
  },

  // ── Tier 2: STRICT rules for the telemetry module ───────────────────────
  //
  // Rationale: telemetry/ is the most safety-critical module in this workspace.
  // Instrumentation bugs are silent — a missed flush or a silently swallowed
  // promise causes data loss without a visible error.  Strict linting makes
  // those failure modes impossible to write by accident.
  //
  // All rules here are 'error' — they block CI (see .github/workflows/lint.yml).
  {
    files: ['src/app/telemetry/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Upgrade warnings to errors for this module
      '@typescript-eslint/no-explicit-any': 'error',

      // Every exported / class member function must declare its return type.
      // Prevents accidental `any` bleed from implicit inference.
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions:            true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions:   true,
      }],

      // Unhandled promises are silent failures in event pipelines.
      '@typescript-eslint/no-floating-promises': ['error', {
        ignoreVoid: true,   // void operator is an explicit opt-out
        ignoreIIFE: false,
      }],

      // Implicit truthiness coercions can mask null vs empty-string bugs
      // in tag maps and event name strings.
      '@typescript-eslint/strict-boolean-expressions': ['error', {
        allowNullableBoolean: true,   // `if (flag)` is fine for boolean | undefined
        allowNullableString:  false,  // `if (str)` is NOT fine — be explicit
        allowNumber:          false,  // `if (count)` is NOT fine — use count !== 0
        allowNullableNumber:  false,
        allowAny:             false,
      }],

      // Class fields that are only assigned in the constructor should be readonly.
      // Enforces immutability discipline in service classes.
      '@typescript-eslint/prefer-readonly': 'error',

      // Redundant casts (e.g. `x as string` when x: string) are a code smell.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Prevent narrowing assertions that can never fail — sign of stale code.
      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: true,
      }],
    },
  },
];
