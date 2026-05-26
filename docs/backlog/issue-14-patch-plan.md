# Simulated Patch Plan — Issue #14
## `TelemetryErrorHandler` missing `enableTelemetry` flag guard

### Delegation brief (what you'd hand to an agent)

> **Task**: Fix `src/app/telemetry/telemetry-error-handler.ts` so that
> `handleError()` does not emit a telemetry counter when the
> `enableTelemetry` feature flag is OFF. The fix must be consistent with
> the existing pattern in `RouterTelemetryService` (lines 32–38).
> A test covering the flag-OFF path is required.
> Do NOT change `console.error` — it must always fire regardless of flag state.

---

### Step 1 — Edit `telemetry-error-handler.ts`

**File**: `src/app/telemetry/telemetry-error-handler.ts`

```diff
-import { ErrorHandler, Injectable } from '@angular/core';
+import { ErrorHandler, Injectable } from '@angular/core';
 import { TelemetryService } from './telemetry.service';
 import { errorToMeta, LOG_PREFIX } from './resilience';
+import { isFlagEnabled } from '../feature-flags/feature-flag.service';

 @Injectable()
 export class TelemetryErrorHandler implements ErrorHandler {
   constructor(private readonly telemetry: TelemetryService) {}

   handleError(error: unknown): void {
     const { name, message } = errorToMeta(error);
-    this.telemetry.counter('error.unhandled', 1, {
-      error_name: name,
-      error_message: message.slice(0, 120),
-    });
+    if (isFlagEnabled('enableTelemetry')) {
+      this.telemetry.counter('error.unhandled', 1, {
+        error_name: name,
+        error_message: message.slice(0, 120),
+      });
+    }
     console.error(LOG_PREFIX, 'unhandled error:', error);
   }
 }
```

**Verification**: `grep -n "isFlagEnabled" src/app/telemetry/telemetry-error-handler.ts` → should show line ~5 and ~13.

---

### Step 2 — Add test coverage

**File**: `src/app/telemetry/telemetry-error-handler.spec.ts`

Add a describe block for the flag-OFF path:

```typescript
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';

describe('TelemetryErrorHandler — flag OFF', () => {
  let handler: TelemetryErrorHandler;
  let telemetry: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
    _setFlagOverridesForTesting({ enableTelemetry: false });
    telemetry = jasmine.createSpyObj('TelemetryService', ['counter']);
    handler = new TelemetryErrorHandler(telemetry);
  });

  afterEach(() => _setFlagOverridesForTesting(null));

  it('should NOT emit counter when enableTelemetry is false', () => {
    handler.handleError(new Error('test'));
    expect(telemetry.counter).not.toHaveBeenCalled();
  });
});
```

---

### Step 3 — Run tests

```bash
cd /path/to/repo
npm run test:ci -- --include=**/telemetry-error-handler.spec.ts
```

Expected: all tests pass including the new flag-OFF test.

---

### Step 4 — Verify consistency across telemetry services

```bash
grep -n "isFlagEnabled('enableTelemetry')" \
  src/app/telemetry/telemetry-error-handler.ts \
  src/app/telemetry/router-telemetry.service.ts \
  src/app/telemetry/web-vitals.service.ts
```

All 3 files should now have the guard.

---

### Step 5 — Commit

```bash
git checkout -b fix/telemetry-error-handler-flag-guard
git add src/app/telemetry/telemetry-error-handler.ts \
        src/app/telemetry/telemetry-error-handler.spec.ts
git commit -m "fix(telemetry): guard TelemetryErrorHandler counter behind enableTelemetry flag

Fixes #14

TelemetryErrorHandler was the only telemetry service that did not check
the enableTelemetry feature flag before recording metrics. This meant
error.unhandled counters were emitted and console-logged even when
telemetry was supposed to be disabled.

- Add isFlagEnabled('enableTelemetry') guard around telemetry.counter()
- console.error() still fires regardless of flag state (dev UX preserved)
- New test covers the flag-OFF path with _setFlagOverridesForTesting

Consistent with the existing pattern in RouterTelemetryService (lines 32–38)
and WebVitalsService (lines 34–37).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push -u origin fix/telemetry-error-handler-flag-guard
gh pr create --title "fix(telemetry): guard TelemetryErrorHandler counter behind enableTelemetry flag" \
  --body "Fixes #14" --base feat/telemetry-production-backend
```

---

### Risk assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `console.error` accidentally removed | Low | Spec checks flag-ON path still logs |
| `isFlagEnabled` import path wrong | Low | `tsc --noEmit` catches at compile time |
| Test override not reset in afterEach | Medium | Template includes `afterEach(() => _setFlagOverridesForTesting(null))` |

**Effort estimate**: ~30 minutes. Ideal `good first issue` — one file touched, clear pattern to follow, test template provided.
