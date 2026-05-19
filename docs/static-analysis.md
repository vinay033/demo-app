# Static Analysis

This workspace enforces static analysis at two tiers of strictness.

## Tools

| Tool | Version | Config file |
|------|---------|-------------|
| ESLint | 10.x | `eslint.config.js` (flat config) |
| `@typescript-eslint` | 8.x | embedded in `eslint.config.js` |
| `@angular-eslint` | 21.x | embedded in `eslint.config.js` |
| TypeScript compiler | 4.7 | `tsconfig.json` (`strict: true`) |

## Tier 1 — workspace baseline

**Applies to:** `src/**/*.ts`, `projects/**/*.ts`

**CI job:** `Lint / workspace` — advisory (`continue-on-error: true`), never blocks a merge.

Run locally:
```bash
npm run lint
```

Key rules:
- `@typescript-eslint/no-explicit-any` — warn (surface `any` for review)
- `@typescript-eslint/no-unused-vars` — error
- `@typescript-eslint/ban-ts-comment` — error (no `@ts-ignore` bypass)
- `@angular-eslint/contextual-lifecycle` — error
- `@angular-eslint/no-empty-lifecycle-method` — error
- `@angular-eslint/prefer-inject` — warn (Angular 14 constructor DI is conventional; migrate with [ng generate @angular/core:inject](https://angular.dev/reference/migrations/inject-function) when upgrading to Angular 16+)

## Tier 2 — telemetry module strict

**Applies to:** `src/app/telemetry/**/*.ts`

**CI job:** `Lint / telemetry (strict)` — **hard gate**, blocks merge on errors.

Run locally:
```bash
npm run lint:telemetry
```

### Rationale

`src/app/telemetry/` is the most safety-critical module in this workspace.
Instrumentation bugs are **silent** — a missed flush, an unhandled promise, or an implicit empty-string truthiness coercion causes data loss without any visible error.
Strict linting makes those failure modes impossible to introduce accidentally.

### Strict rules

| Rule | Setting | Why |
|------|---------|-----|
| `explicit-function-return-type` | error | Prevents accidental `any` bleed from implicit return type inference |
| `no-floating-promises` | error | Unhandled promises in event pipelines = silent data loss |
| `strict-boolean-expressions` | error | `if (str)` / `if (count)` coercions mask null-vs-empty-string bugs in tag maps |
| `prefer-readonly` | error | Service class fields that are only written in the constructor must be `readonly` |
| `no-unnecessary-type-assertion` | error | Redundant casts (`x as string` when x is already `string`) signal stale code |
| `no-unnecessary-condition` | error | Conditions that can never be false are a sign of dead code |

### Known warnings (4)

The four `@angular-eslint/prefer-inject` warnings are **expected** and come from
Angular 14 constructor injection patterns in `RouterTelemetryService`,
`TelemetryErrorHandler`, and `WebVitalsService`.  These will be migrated to
`inject()` as part of Epic #2 (Angular v14 → v16 upgrade).

The `--max-warnings 4` guard ensures any _new_ warning in this module fails CI.

## TypeScript compiler strictness

The root `tsconfig.json` already enables:

```json
{
  "strict": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

And Angular template compiler options:
```json
{
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true,
  "strictTemplates": true
}
```

Remaining TypeScript strict flags not yet enabled (tracked in Epic #2):
- `exactOptionalPropertyTypes` — requires explicit `undefined` on optional property assignment
- `noUncheckedIndexedAccess` — adds `| undefined` to array index access results

These will be evaluated as part of the Angular v14 → v16 upgrade due to the number of call-sites they affect.

## Adding a new lint rule

1. Add the rule to `eslint.config.js` in the appropriate tier block
2. Run `npm run lint` (tier 1) or `npm run lint:telemetry` (tier 2) to see violations
3. Fix violations or add a targeted `// eslint-disable-next-line` with a justification comment
4. If adding to the telemetry strict tier, update the table in this doc
5. If adding a new `@angular-eslint/prefer-inject` suppress pattern, increment `--max-warnings` in `package.json` and document here
