# Contributing to demo-app

Thank you for contributing! This document covers everything you need to get changes merged: branching conventions, PR expectations, and how to work effectively with GitHub Copilot in this repo.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Branching Strategy](#branching-strategy)
3. [Commit Message Convention](#commit-message-convention)
4. [Pull Request Expectations](#pull-request-expectations)
5. [Running Tests and Coverage Locally](#running-tests-and-coverage-locally)
6. [Working with GitHub Copilot](#working-with-github-copilot)
7. [Project Structure Quick Reference](#project-structure-quick-reference)

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Angular CLI | 14.x (`npm i -g @angular/cli@14`) |
| Chrome / Chromium | Any recent version (tests run headless) |

Install dependencies after cloning:

```bash
npm install --legacy-peer-deps
```

---

## Branching Strategy

This repo uses a **trunk-based** workflow with short-lived feature branches off `master`.

### Branch naming

```
<type>/<short-description>
```

| Type | When to use | Example |
|---|---|---|
| `feat/` | New feature or capability | `feat/add-user-login` |
| `fix/` | Bug fix | `fix/store-unsubscribe-leak` |
| `refactor/` | Code restructuring, no behaviour change | `refactor/extract-karma-factory` |
| `docs/` | Documentation only | `docs/architecture-diagram` |
| `test/` | Adding or fixing tests/coverage | `test/enable-coverage-reporting` |
| `chore/` | Tooling, deps, CI | `chore/upgrade-angular-15` |

### Rules

- Branch off `master` — never off another feature branch.
- Keep branches short-lived (days, not weeks).
- One logical change per branch; split unrelated work into separate PRs.
- Delete the branch after it is merged.

```bash
git checkout master && git pull origin master
git checkout -b feat/my-feature
# ... make changes ...
git push origin feat/my-feature
gh pr create --base master
```

---

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional body — wrap at 72 chars>

<optional footer — breaking changes, issue refs, co-authors>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Examples:**

```
feat(sub-app1): expose AppComponent via Module Federation remoteEntry
fix(store): call unsubscribe in StoreListenerService.ngOnDestroy
docs: add branching strategy to CONTRIBUTING
test(demo-app): raise coverage threshold to 80%
```

When committing with Copilot's help, always append the co-author trailer:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Pull Request Expectations

### Before opening a PR

- [ ] All 9 tests pass: `ng test --no-watch --browsers=ChromeHeadlessCI`
- [ ] No TypeScript errors: `npx tsc --noEmit -p tsconfig.app.json`  
- [ ] Architecture diagrams still render: `npm run validate:docs`
- [ ] Branch is up to date with `master` (rebase, don't merge)

### PR title

Use the same Conventional Commits format as your commit messages:

```
feat(sub-app2): wire lazy-loaded route for Module Federation
```

### PR description must include

1. **Summary** — one paragraph explaining *what* changed and *why*.
2. **Files changed** — table of files and the reason each was touched.
3. **Test evidence** — paste the `TOTAL: N SUCCESS` and coverage summary lines from a local run.
4. **Refactor plan** (if applicable) — problem, files, expected impact (see existing PRs for examples).

### PR size

Keep PRs small and reviewable. A good PR changes fewer than 400 lines. If your change is larger, split it into a stacked series of PRs.

### Review process

- At least one approval is required before merging.
- Resolve all review comments before merging (or explicitly mark as `won't fix` with a reason).
- Squash-merge into `master` to keep history linear.

---

## Running Tests and Coverage Locally

See the [README](./README.md#running-coverage-locally) for the full reference. Quick summary:

```bash
# All projects, headless, single run
ng test --no-watch --browsers=ChromeHeadlessCI          # demo-app
ng test sub-app1 --no-watch --browsers=ChromeHeadlessCI # sub-app1
ng test sub-app2 --no-watch --browsers=ChromeHeadlessCI # sub-app2

# Validate Mermaid diagrams in docs/architecture.md
npm run validate:docs
```

Coverage reports are written to `coverage/<project>/` after each run.  
Open `coverage/demo-app/index.html` for a line-by-line HTML report.

### Adding a coverage threshold

Add a `check` block to `scripts/karma.base.js` to fail the build below a minimum:

```js
coverageReporter: {
  ...
  check: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 }
  }
}
```

---

## Working with GitHub Copilot

This repo was set up with [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli) in mind. Here is how to get the most out of it.

### Starting a session

Open the repo in a terminal and launch the Copilot CLI. Copilot will read the workspace structure automatically.

### Suggested prompts for this repo

| Task | Prompt to try |
|---|---|
| Explore the codebase | *"List entry points, key modules, and their file paths"* |
| Architecture questions | *"Explain the Module Federation setup and what's missing"* |
| Adding a feature | *"Add a counter component to sub-app1 with a Redux action and reducer"* |
| Coverage gap | *"Which lines in StoreListenerService are not covered? Write a spec"* |
| Refactoring | *"Identify duplicated code and generate diffs file-by-file"* |
| PR workflow | *"Run the full test suite and update the PR description with evidence"* |

### What Copilot maintains in this repo

| Artifact | Path | Purpose |
|---|---|---|
| Architecture doc | `docs/architecture.md` | Mermaid diagrams mapping nodes to file paths |
| Diagram validator | `scripts/validate-diagrams.mjs` | Ensures diagrams render without errors |
| Karma factory | `scripts/karma.base.js` | Single source of truth for Karma config |
| CI workflow | `.github/workflows/validate-docs.yml` | Validates diagrams on every relevant push |

### Keeping Copilot in context

- Point Copilot at `docs/architecture.md` when asking structural questions — it has the most up-to-date file path map.
- After any architectural change (new module, new remote), ask Copilot to update `docs/architecture.md` and re-run `npm run validate:docs`.
- Commit messages generated with Copilot should include the `Co-authored-by` trailer (see above).

### What Copilot will not do

- Commit secrets or credentials to source control.
- Modify files outside the repository root without explicit instruction.
- Make changes outside the scope of your request without flagging them.

---

## Project Structure Quick Reference

```
demo-app/
├── src/                          # Host shell (demo-app)
│   ├── app/
│   │   ├── app.module.ts
│   │   ├── app.component.ts
│   │   ├── app-routing.module.ts
│   │   └── store-listener.service.ts
│   └── environments/
│       ├── environment.ts        # Single source of truth for all projects
│       └── environment.prod.ts
├── projects/
│   ├── sub-app1/                 # Remote micro-frontend (:4201)
│   │   ├── src/app/
│   │   └── store/                # Redux store (store.ts, index.ts)
│   └── sub-app2/                 # Remote micro-frontend (:4202)
│       └── src/app/
├── docs/
│   └── architecture.md           # Mermaid architecture diagrams
├── scripts/
│   ├── karma.base.js             # Shared Karma config factory
│   └── validate-diagrams.mjs    # Mermaid diagram validator
├── .github/workflows/
│   └── validate-docs.yml         # CI: diagram validation
├── angular.json                  # Workspace + all project build config
└── karma.conf.js                 # demo-app Karma wrapper (delegates to scripts/karma.base.js)
```
