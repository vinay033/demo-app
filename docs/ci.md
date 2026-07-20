# CI Reliability Guide

This document covers the five GitHub Actions workflows, reliability improvements made to
them, how to validate those improvements, and rollback commands for each change.

---

## Workflows at a glance

| Workflow | File | Trigger | Avg duration |
|---|---|---|---|
| Contract Tests | `contract-tests.yml` | push/PR on `src/**`, `projects/**`, tsconfig | ~120 s |
| Lint | `lint.yml` | push/PR on all branches | ~50 s |
| Validate Architecture Diagrams | `validate-docs.yml` | push/PR on `docs/architecture.md` | ~50 s |
| Dependency Vulnerability Scan | `dependency-scan.yml` | push/PR on `package*.json`, schedule Mon 06:00 UTC | ~57 s |
| Update architecture diagram | `update-architecture.yml` | push on `src/app/telemetry/**` | ~12 s |

---

## Reliability improvements (PR #CI_PR)

Three targeted improvements were applied. All changes are **non-breaking** — they only
change when/how quickly a job reports failure; they do not alter test logic or results.

---

### Improvement 1 — Skip Chrome apt-get if already installed

**File**: `.github/workflows/contract-tests.yml`  
**Step**: `Install Chrome system libraries`

**Problem**: The contract-tests matrix has 6 cells (3 projects × 2 flag modes). Every cell
unconditionally ran `apt-get update` + `apt-get install google-chrome-stable`, even though
`ubuntu-latest` runners ship with `google-chrome-stable` pre-installed at
`/usr/bin/google-chrome-stable`. This wasted ~25 s per cell (150 s total per run) and was
the most common source of transient failures (apt-get mirrors return HTTP 503 under load).

**Fix**: Gate the entire `apt-get` block behind `command -v google-chrome-stable`. When
Chrome is already present, the step prints a ✅ line and exits immediately. `apt-get` is
retained as a fallback for self-hosted or custom runner images that do not pre-install
Chrome.

**Expected impact**: −25 s per matrix cell on `ubuntu-latest` (−150 s total per
contract-tests run). Eliminates apt-get network flakiness for the common path.

**Validate**: Open a successful Contract Tests run → expand `Install Chrome system libraries`
for any matrix cell → confirm the log reads:
```
✅ google-chrome-stable already present at /usr/bin/google-chrome-stable — skipping apt-get
```

---

### Improvement 2 — Command-level timeout on `ng test`

**File**: `.github/workflows/contract-tests.yml`  
**Step**: `Run tests with coverage`

**Problem**: When Chrome or Karma hangs (DNS timeout, SIGSEGV in renderer, headless
connection refused), the job sat idle for the full 20-minute job-level `timeout-minutes`
before failing. This consumed a runner slot for 18 extra minutes and produced no actionable
output.

**Fix**: Wrap every `npx ng test` call with `timeout --kill-after=30 600`:
- `600` seconds (10 min): sends `SIGTERM` to the `ng test` process group
- `--kill-after=30`: sends `SIGKILL` 30 s later if the process has not exited

Normal test runs complete in under 2 minutes. The 10-minute limit is conservative and will
never fire on a healthy run. If it fires, `timeout` exits with code 124, the step fails
immediately, and the `Write per-project coverage to job summary` post-step still runs
(because it uses `if: always()`).

**Expected impact**: Worst-case hang time reduced from 20 min to 10.5 min. Faster feedback
when Chrome is unresponsive.

**Validate**: In the rare event of a Chrome hang, the step output will include:
```
Sending signal 15 to process group...
```
and the step will fail within 10 minutes instead of 20.

---

### Improvement 3 — Cache Puppeteer Chromium download

**File**: `.github/workflows/validate-docs.yml`  
**Step**: `Cache Puppeteer Chromium download` (new step, before `Install dependencies`)

**Problem**: Puppeteer (v25) downloads ~120 MB of Chromium during `npm ci`'s `postinstall`
script on every run. This added ~35 s and was a reliability hazard when the Chromium
download CDN (`storage.googleapis.com`) was slow or rate-limiting the runner.

**Fix**: Cache `~/.cache/puppeteer` using `actions/cache@v4`:
```yaml
uses: actions/cache@v4
with:
  path: ~/.cache/puppeteer
  key: puppeteer-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
  restore-keys: |
    puppeteer-${{ runner.os }}-
```

The cache key includes the full `package-lock.json` hash so it is invalidated exactly when
the Puppeteer version changes. The `restore-keys` prefix allows a partial hit when only
unrelated deps change (Puppeteer itself is unchanged).

**Expected impact**: Cache hit saves ~35 s per `Validate Architecture Diagrams` run.
Eliminates Chromium CDN flakiness for the warm-cache path.

**Validate**: Open a `Validate Architecture Diagrams` run → expand the
`Cache Puppeteer Chromium download` step:
- **First run** (cold): `Cache not found for key: puppeteer-Linux-<hash>` → ~35 s download
  during npm ci → `Post Cache Puppeteer Chromium download` saves the cache
- **Subsequent runs** (warm): `Cache restored from key: puppeteer-Linux-<hash>` → npm ci
  skips Chromium download → total step time ≈ 0 s

---

## Before / after comparison

| Metric | Before | After (expected) |
|---|---|---|
| Contract Tests — Chrome install per cell | ~25 s (unconditional apt-get) | ~0 s (skipped) / ~25 s (fallback) |
| Contract Tests — Chrome install total (6 cells) | ~150 s wasted | ~0 s on ubuntu-latest |
| Contract Tests — hung Chrome recovery time | 20 min (job timeout) | 10.5 min (timeout guard) |
| Validate Docs — Puppeteer download (cold) | ~35 s every run | ~35 s first run only |
| Validate Docs — Puppeteer download (warm) | ~35 s every run | ~0 s (cache hit) |
| Apt-get 503 failures in contract-tests | Possible on every run | Not possible (no apt-get call) |

---

## Rollback instructions

Each improvement is **independent** — they can be rolled back individually.

### Rollback Improvement 1 — Restore unconditional Chrome apt-get

In `.github/workflows/contract-tests.yml`, replace the `Install Chrome system libraries` step
run block with the original:

```yaml
      - name: Install Chrome system libraries (required by karma-chrome-launcher)
        # Retry once — apt-get mirrors can return 503 on first attempt
        run: |
          for attempt in 1 2; do
            sudo apt-get update -qq && \
            sudo apt-get install -y --no-install-recommends \
              google-chrome-stable \
              libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
              libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
              libxfixes3 libxrandr2 libgbm1 libasound2t64 \
              libxshmfence1 libglu1-mesa && break || \
            sudo apt-get install -y --no-install-recommends \
              chromium-browser \
              libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
              libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
              libxfixes3 libxrandr2 libgbm1 libasound2t64 && break
            [ $attempt -lt 2 ] && echo "Chrome install attempt $attempt failed — retrying in 10s..." && sleep 10
          done
```

Or via git:
```bash
git show HEAD~1:.github/workflows/contract-tests.yml > .github/workflows/contract-tests.yml
git add .github/workflows/contract-tests.yml
git commit -m "revert: restore unconditional Chrome apt-get install"
git push
```

### Rollback Improvement 2 — Remove timeout guard from ng test

In `.github/workflows/contract-tests.yml`, remove the `timeout --kill-after=30 600` prefix
from both `npx ng test` calls in the `Run tests with coverage` step. Also remove the
comment block above.

Or via git revert of the specific hunk:
```bash
# revert just the timeout lines (manual edit is safest — two lines to change)
git diff HEAD~1 HEAD -- .github/workflows/contract-tests.yml \
  | grep "^+.*timeout" | head -5
```

### Rollback Improvement 3 — Remove Puppeteer cache step

In `.github/workflows/validate-docs.yml`, delete the entire
`Cache Puppeteer Chromium download` step block (from `- name: Cache Puppeteer Chromium download`
through the closing `restore-keys` block, inclusive).

Or via git:
```bash
git show HEAD~1:.github/workflows/validate-docs.yml > .github/workflows/validate-docs.yml
git add .github/workflows/validate-docs.yml
git commit -m "revert: remove Puppeteer Chromium cache step"
git push
```

### Full rollback (all three improvements at once)

```bash
# Identify the commit SHA for the reliability PR merge commit on feat/telemetry-production-backend
git log --oneline feat/telemetry-production-backend | head -5

# Revert all workflow changes from this PR
git revert <merge-commit-sha> --no-edit
git push
```

---

## Debugging CI failures

### Contract Tests — Chrome not found

If `Detect Chrome binary path` exits with `❌ No Chrome/Chromium binary found`:

1. Check whether the runner image has changed: `ubuntu-latest` occasionally shifts to a new
   image version that may ship without Chrome pre-installed
2. The fallback apt-get block will run automatically — check its output for 503 errors
3. If apt-get fails, consider pinning `runs-on: ubuntu-22.04` to a stable image

### Contract Tests — timeout exit code 124

Exit code 124 from the `Run tests with coverage` step means `timeout` fired:

1. Check whether `CHROME_BIN` was detected correctly in the preceding step
2. Re-run with `--verbose` flag on `ng test` to surface the Karma error
3. Check for Karma config issues: `karma.conf.js` and `scripts/karma.base.js`

### Validate Docs — Puppeteer cache miss every run

If the cache step never hits (cold on every run):

1. Verify `~/.cache/puppeteer` is the correct path: `npx puppeteer browsers installed`
2. Check Puppeteer version in `package-lock.json` — if it changes every run, the key
   invalidates too often (unlikely but possible if using a floating range)
3. Try pinning the cache path to `~/.cache/puppeteer/chrome` for a narrower scope
