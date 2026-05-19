# Feature Flag Lifecycle

Feature flags in this repo are **compile-time boolean constants** read from
`src/environments/environment.ts` (dev) and `src/environments/environment.prod.ts`
(prod). They are not remote-config flags — they are baked into the build at
`ng build` time using Angular's `fileReplacements` mechanism.

---

## Table of contents

1. [Flag registry](#flag-registry)
2. [Stage 1 — Creation](#stage-1--creation)
3. [Stage 2 — Default state](#stage-2--default-state)
4. [Stage 3 — Enabling a flag](#stage-3--enabling-a-flag)
5. [Stage 4 — Disabling a flag](#stage-4--disabling-a-flag)
6. [Stage 5 — Removal](#stage-5--removal)
7. [Using flags in code](#using-flags-in-code)
8. [Contract test and CI gate](#contract-test-and-ci-gate)
9. [Naming conventions](#naming-conventions)
10. [Anti-patterns](#anti-patterns)

---

## Flag registry

Every flag that currently exists in the codebase:

| Flag | Type | Dev default | Prod default | Guards |
|---|---|---|---|---|
| `enableTelemetry` | boolean | `true` | `false` | `TelemetryErrorHandler`, `RouterTelemetryService`, `WebVitalsService` |
| `enableReduxMonitor` | boolean | `true` | `false` | `dispatchMonitorEnhancer` in `projects/sub-app1/store/store.ts` |
| `enableMfeTiming` | boolean | `true` | `false` | `mfeTimed()` in `src/app/app-routing.module.ts` _(future)_ |

**Source of truth:** [`src/app/feature-flags/feature-flag.service.ts`](../src/app/feature-flags/feature-flag.service.ts) — the `FeatureFlags` interface is the canonical type; the environments implement it.

---

## Stage 1 — Creation

### 1a. Add the flag to the type

Open [`src/app/feature-flags/feature-flag.service.ts`](../src/app/feature-flags/feature-flag.service.ts)
and append a new key to the `FeatureFlags` interface with a JSDoc comment
explaining what it gates:

```typescript
export interface FeatureFlags {
  enableTelemetry: boolean;
  enableReduxMonitor: boolean;
  enableMfeTiming: boolean;
  enableMyNewFeature: boolean; // ← add here
}
```

### 1b. Add the flag to both environment files

**`src/environments/environment.ts`** (dev — default ON):
```typescript
const featureFlags: FeatureFlags = {
  // ...existing flags...
  enableMyNewFeature: true,  // dev: on so engineers can test immediately
};
```

**`src/environments/environment.prod.ts`** (prod — default OFF):
```typescript
const featureFlags: FeatureFlags = {
  // ...existing flags...
  enableMyNewFeature: false, // prod: off until validated in staging
};
```

### 1c. Update the contract test

Open [`src/environments/environment.contract.spec.ts`](../src/environments/environment.contract.spec.ts)
and add `'enableMyNewFeature'` to both `ALLOWED_FLAGS` arrays. This is the
**intentional review gate** — the test will fail until you explicitly
acknowledge the new flag.

### 1d. Add the guard to the feature code

See [Using flags in code](#using-flags-in-code) below.

---

## Stage 2 — Default state

| Environment | Default | Why |
|---|---|---|
| **Dev** (`environment.ts`) | `true` | Engineers can exercise the feature without any setup |
| **Prod** (`environment.prod.ts`) | `false` | Safe default — new code is off until explicitly validated |
| **Test** (Karma) | Uses `environment.ts` | Tests run in the dev environment; flag is `true` |

> **Override in tests:** If a spec needs to test the *disabled* path, spy on
> the environment directly:
> ```typescript
> import * as env from '../../environments/environment';
> spyOnProperty(env.environment.featureFlags, 'enableMyNewFeature').and.returnValue(false);
> ```

---

## Stage 3 — Enabling a flag

### In production (permanent enable)

1. Set the flag to `true` in `src/environments/environment.prod.ts`.
2. Open a PR titled `feat(flags): enable <flagName> in production`.
3. The PR must include:
   - Evidence the feature was validated in staging.
   - A note in the PR description that the **removal** window starts now.

### In staging (one-off validation)

Since flags are compile-time, staging validation requires a dedicated build:

```bash
# Build with a staging environment that overrides the flag
ng build --configuration=production
# Then swap environment.prod.ts values for the staging deploy
```

Alternatively, use an environment variable substitution step in your deploy
pipeline to swap the flag value before `ng build`.

### Locally (disable the dev default)

To test the *disabled* path in your local dev server:

```typescript
// src/environments/environment.ts — temporary local change, do NOT commit
const featureFlags: FeatureFlags = {
  enableMyNewFeature: false, // ← flip for local testing
};
```

---

## Stage 4 — Disabling a flag

A flag should be temporarily disabled (not removed) when:

- A regression is detected in production and you need to roll back the feature.
- The feature is being reworked and should not ship in the current release.

### Disable in production

1. Set the flag to `false` in `src/environments/environment.prod.ts`.
2. Commit and deploy immediately — this is a hotfix-class change.
3. Add a comment explaining *why* it was disabled and when it can be re-enabled.

```typescript
// Disabled 2026-05-19: CLS regression in Safari — see issue #42.
// Re-enable after WebVitalsService patch lands in next release.
enableTelemetry: false,
```

---

## Stage 5 — Removal

Remove a flag **when both conditions are true:**

1. The flag has been `true` in production for **≥ 2 consecutive release cycles**.
2. No rollback request has been filed during that window.

### Removal checklist

- [ ] Delete the flag key from `FeatureFlags` interface in `feature-flag.service.ts`.
- [ ] Delete the flag key from `environment.ts` and `environment.prod.ts`.
- [ ] Remove the `ALLOWED_FLAGS` entry from `environment.contract.spec.ts`.
- [ ] Find every `isFlagEnabled('enableMyNewFeature')` or `isEnabled('enableMyNewFeature')`
      call-site and replace with the unconditional feature code:
      ```bash
      grep -rn "enableMyNewFeature" src/ projects/ --include="*.ts"
      ```
- [ ] Delete any spec that tests the *disabled* path for this flag.
- [ ] Run `ng test --no-watch --browsers=ChromeHeadlessCI` — must pass.
- [ ] Open a PR titled `refactor(flags): remove enableMyNewFeature`.

> **Never leave dead flag guards in the codebase.** A flag past its removal
> window is tech debt. Schedule removal in the same sprint as the
> "permanently enabled" decision.

---

## Using flags in code

### Inside Angular DI (components, services, modules)

Inject `FeatureFlagService` and call `isEnabled()`:

```typescript
import { FeatureFlagService } from '../feature-flags/feature-flag.service';

@Injectable({ providedIn: 'root' })
export class MyService {
  constructor(private readonly flags: FeatureFlagService) {
    if (!this.flags.isEnabled('enableMyNewFeature')) {
      return; // early exit — feature is off
    }
    // feature code
  }
}
```

### In `AppModule` providers (conditional provider registration)

```typescript
// app.module.ts
providers: [
  isFlagEnabled('enableMyNewFeature')
    ? { provide: MY_TOKEN, useClass: NewImpl }
    : { provide: MY_TOKEN, useClass: LegacyImpl },
]
```

### Outside Angular DI (Redux enhancers, factory functions)

Use the standalone `isFlagEnabled()` helper:

```typescript
import { isFlagEnabled } from '../../../src/app/feature-flags/feature-flag.service';

if (isFlagEnabled('enableReduxMonitor')) {
  // enhancement code
}
```

**File:** [`projects/sub-app1/store/store.ts`](../projects/sub-app1/store/store.ts) — live example.

### In templates

Add a getter to the component class (do not inject the service into templates):

```typescript
get isMyFeatureEnabled(): boolean {
  return this.flags.isEnabled('enableMyNewFeature');
}
```

```html
<my-new-component *ngIf="isMyFeatureEnabled"></my-new-component>
```

---

## Contract test and CI gate

[`src/environments/environment.contract.spec.ts`](../src/environments/environment.contract.spec.ts)
enforces three invariants:

| Rule | What breaks if violated |
|---|---|
| `featureFlags` key exists in both environments | Build fails — TypeScript type mismatch |
| Both environments have exactly the same flag names | Contract spec FAILED — intentional review gate |
| All flag values are booleans | Contract spec FAILED |

The contract test runs in CI as part of the `contract-tests` workflow. It is
the mechanism that prevents:

- A flag being added to `FeatureFlags` but forgotten in `environment.prod.ts`.
- A flag being silently removed from one environment but not the other.
- A non-boolean value sneaking in.

---

## Naming conventions

| Rule | Good | Bad |
|---|---|---|
| `enable<FeatureName>` (positive, camelCase) | `enableTelemetry` | `telemetryOff`, `TELEMETRY_FLAG` |
| Describes the feature, not the team | `enableReduxMonitor` | `enablePlatformTeamQ2Work` |
| Noun or noun-phrase after `enable` | `enableMfeTiming` | `enableFast` |
| No version numbers | `enableNewRouter` | `enableRouterV2` |

---

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Checking a flag in a template with `*ngIf` directly | Couples the template to the service | Add a getter in the component class |
| Nesting flag guards (`if flag A && flag B`) | Combinatorial explosion; hard to test | One flag per feature; compose at the module level |
| Leaving a flag `false` in prod indefinitely | Dead code accumulates | Schedule removal after ≥ 2 release cycles |
| Using a flag to gate a *bug fix* | Bug fixes should not be behind flags | Ship the fix unconditionally; use flags only for new behaviour |
| Committing a local `environment.ts` flip to `main` | All dev builds lose the default | Use `git stash` or a local override file (gitignored) |
