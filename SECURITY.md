# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report suspected vulnerabilities by emailing the maintainers directly or by using [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository.

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected versions and components

You will receive an acknowledgement within **48 hours** and a resolution plan within **7 days**.

---

## Supported versions

This is a demonstration workspace. Only the current `master` branch is actively maintained.

| Branch / version | Supported |
|---|---|
| `master` (current) | ✅ |
| Older branches | ❌ |

---

## Dependency vulnerability scanning

### How it works

Every dependency is scanned using [`audit-ci`](https://github.com/IBM/audit-ci) against the npm advisory database.

Scanning runs in **two places**:

| Location | Trigger | Hard-fail level |
|---|---|---|
| **Pre-commit hook** (`.husky/pre-commit`) | Every `git commit` | Critical advisories not in allowlist |
| **CI workflow** (`.github/workflows/dependency-scan.yml`) | Push/PR touching `package.json` or lock file; weekly schedule (Mon 06:00 UTC) | Critical advisories not in allowlist |

The CI job also uploads a full `npm audit --json` report as a 30-day artifact and prints a severity summary to the GitHub Actions step summary.

### Running the scan locally

```bash
# Quick scan — same check the pre-commit hook runs
npx audit-ci --config audit-ci.json

# Full report with all severities
npm audit

# JSON report (for tooling / diffing)
npm audit --json > audit-report.json
```

### Interpreting the output

`audit-ci` exits **0** (pass) if every advisory is either:
- Not present in the dependency tree, or
- Explicitly listed in the `allowlist` array in `audit-ci.json`

It exits **non-zero** (fail) if any advisory at or above the configured level (`critical: true`) is found that is **not** in the allowlist.

---

## Known accepted risks

All advisories listed below were reviewed on **2026-05-18** and accepted for the reason stated. The allowlist is maintained in [`audit-ci.json`](./audit-ci.json).

### What was fixed

On 2026-05-18, 33 of 73 advisories were resolved by:

1. Upgrading `@angular/cli` 14.0.7 → 14.2.13 (latest in the 14.x series)
2. Upgrading `@angular-devkit/build-angular` 14.2.11 → 14.2.13
3. Running `npm audit fix` (86 package changes, no breaking changes)

This eliminated the only **critical** advisory (`GHSA-67hx-6x53-jw92` — `@babel/traverse` arbitrary code execution).

### Remaining 40 advisories — justified acceptance

All 40 remaining advisories are **transitive dependencies** locked into the Angular 14 build toolchain. They cannot be resolved without a full Angular major-version migration. The remediation path is documented under [Angular upgrade path](#angular-upgrade-path) below.

**Risk groups and rationale:**

| Group | Advisories | Severity | Exposure | Rationale |
|---|---|---|---|---|
| Angular XSS / XSRF | `GHSA-58c5-g7wp-6w37`, `GHSA-jrmj-c5cx-3cw6`, `GHSA-v4hv-rgfq-gp49`, `GHSA-prjf-86w9-mfqv` | High | Build pipeline only | No production surface; app is not deployed from this workspace |
| `webpack-dev-server` source exposure | `GHSA-9ppj-qmqm-q256`, `GHSA-qx2v-qp2m-jg93`, `GHSA-8fgc-7cc6-rx7x`, `GHSA-3ppc-4f35-3m26` | High / Moderate | `ng serve` (local dev only) | Never runs in CI or production |
| `node-tar` path traversal | `GHSA-7r86-cg39-jmmj`, `GHSA-r6q2-hw4h-h46w`, `GHSA-2g4f-4pwh-qvx6`, `GHSA-wr3j-pwj9-hqq6`, `GHSA-79cf-xcqc-c78w` | High | `npm install` phase only | Mitigated by pinned `package-lock.json` and `npm ci` in CI |
| `webpack` build-time SSRF / XSS | `GHSA-4vvj-4cpr-p986`, `GHSA-4v9v-hfq4-rm2v`, `GHSA-52f5-9888-hmc6` | High / Moderate | Build config only | Only triggered if an attacker controls the webpack config |
| Build-time ReDoS (minimatch, ajv, serialize-js, babel) | `GHSA-38r7-794h-5758`, `GHSA-34x7-hfp2-rc4v`, `GHSA-23c5-xmqv-rm74`, `GHSA-968p-4wvh-cqc8`, `GHSA-9jgg-88mc-972h`, `GHSA-8qq5-rm4j-mr97`, `GHSA-67mh-4wv8-2f99`, `GHSA-vpq2-c234-7xj6` | High / Moderate | Build inputs only | Only triggered if an attacker controls build inputs |
| Other build-time (postcss, esbuild, copy-webpack-plugin, schematics) | `GHSA-83g3-92jg-28cx`, `GHSA-qffp-2rhf-9h96`, `GHSA-qj8w-gfj5-8c6v`, `GHSA-5c6j-r48x-rmvq`, `GHSA-968p-4wvh-cqc8` | Moderate | Build pipeline only | No user-facing surface |

Full per-advisory rationale: see the `_allowlist_rationale` object in [`audit-ci.json`](./audit-ci.json).

---

## Angular upgrade path

The only way to fully resolve the remaining 40 advisories is to migrate the Angular workspace to a supported major version. The recommended path:

```
Angular 14 (current)
  → Angular 15  (ng update @angular/core@15 @angular/cli@15)
  → Angular 16  (ng update @angular/core@16 @angular/cli@16)
  → Angular 17 LTS  ← first stable target
```

Prerequisites before starting the upgrade:
1. Add ESLint (`ng add @angular-eslint/schematics`)
2. Add `webpack.config.js` for sub-app1 and sub-app2 (Module Federation remote entry)
3. Wire lazy routes in `src/app/app-routing.module.ts`

Both prerequisites are tracked as `TODO` comments in the routing modules and as Known Issues in [`docs/architecture.md`](./docs/architecture.md).

---

## Adding a new advisory to the allowlist

If CI surfaces a new advisory that is a false positive or genuinely accepted risk:

1. Add the GHSA ID to the `allowlist` array in `audit-ci.json`
2. Add a corresponding entry to `_allowlist_rationale` with:
   - The affected package and version range
   - The attack vector and exposure
   - Why it is mitigated or accepted
   - The remediation path and target date
3. Commit both changes **in the same commit** so the risk-acceptance decision is visible as a single PR diff

```jsonc
// audit-ci.json
{
  "allowlist": ["GHSA-xxxx-xxxx-xxxx"],
  "_allowlist_rationale": {
    "GHSA-xxxx-xxxx-xxxx": "package@version — <attack vector>. <why mitigated>. Fix: <target>."
  }
}
```

---

## Removing an advisory from the allowlist

When the underlying package is upgraded and the advisory no longer applies:

1. Remove the GHSA ID from `allowlist` in `audit-ci.json`
2. Remove the corresponding `_allowlist_rationale` entry
3. Run `npm audit` and `npx audit-ci --config audit-ci.json` to confirm the advisory is gone
4. Commit and note in the PR description that the risk has been resolved

---

## Dependency upgrade process

See [`CONTRIBUTING.md § Dependency Upgrade Policy`](./CONTRIBUTING.md#dependency-upgrade-policy) for the full upgrade procedure, including patch/minor/major priority order, the step-by-step recipe, rollback command, and the upgrade log.

---

## Security hygiene controls

The following hygiene controls were added or strengthened on **2026-05-19** as part of a structured security improvement sprint.

### Fix 1 — `.gitignore` secret patterns

**Gap**: The original `.gitignore` had no patterns for credentials, keys, or environment files.  
**Change**: Added a `# Secrets & credentials` section to `.gitignore` covering: `.env`, `*.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `service-account*.json`.  
**Effect**: Git now refuses to track files matching these patterns, preventing accidental secret commits.

To verify the patterns are present run:
```bash
node scripts/security-check.mjs
```

### Fix 2 — `audit-ci.json` threshold raised to `high: true`

**Gap**: The `audit-ci.json` file had `"high": false`. Any new HIGH advisory not yet in the allowlist would **silently pass** CI scans.  
**Change**: Set `"high": true` in `audit-ci.json`. All current HIGH advisories were already individually allowlisted; this change ensures that any **future** unlisted HIGH advisory will fail CI immediately.  
**Effect**: CI breaks on any new unlisted HIGH or CRITICAL advisory; only explicitly reviewed and rationale-documented advisories are allowed to pass.

To verify:
```bash
npx audit-ci --config audit-ci.json   # should exit 0
```

### Fix 3 — Explicit `permissions:` blocks in all GitHub Actions workflows

**Gap**: Four workflows (`contract-tests.yml`, `dependency-scan.yml`, `lint.yml`, `validate-docs.yml`) had no `permissions:` block. GitHub's default is `contents: write` for public repos, meaning any step in those workflows could push commits.  
**Change**: Added `permissions: contents: read` at the top level of each workflow that does not need write access. `update-architecture.yml` retains `contents: write` at the **job** level (it commits the regenerated diagram) but now also declares the top-level default as `read`.  
**Effect**: All five workflows now follow principle of least privilege.

To verify all workflows have an explicit permissions block:
```bash
node scripts/security-check.mjs
```

### Repeatable hygiene check script

`scripts/security-check.mjs` is a repeatable Node.js scanner that verifies all three hygiene controls above plus the live `audit-ci` gate.

```bash
node scripts/security-check.mjs   # exits 0 if all checks pass, 1 otherwise
```

**Checks performed:**

| # | Check | Pass condition |
|---|---|---|
| 1 | `audit-ci.json` threshold | `high: true`, `critical: true`, every allowlisted advisory has a rationale entry |
| 2 | `.gitignore` secret patterns | `.env`, `*.pem`, `*.key`, `*.p12`, `*.pfx` all present |
| 3 | Workflow `permissions:` blocks | Every `.github/workflows/*.yml` file contains a top-level `permissions:` block |
| 4 | Live `audit-ci` gate | `npx audit-ci --config audit-ci.json` exits 0 |

The script can be added to a `pre-push` hook or run in CI as an additional hygiene gate.

### Rollback guidance

| Fix | Revert command |
|---|---|
| `.gitignore` patterns | `git checkout HEAD~1 -- .gitignore` |
| `audit-ci.json` threshold | `git checkout HEAD~1 -- audit-ci.json` |
| Workflow permissions | `git checkout HEAD~1 -- .github/workflows/contract-tests.yml .github/workflows/dependency-scan.yml .github/workflows/lint.yml .github/workflows/update-architecture.yml .github/workflows/validate-docs.yml` |

No functional code was changed; rollback cannot break tests or the build.

