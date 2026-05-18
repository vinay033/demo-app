# Onboarding Walk — Copilot Chat Prompt

> **How to use this file**
> Copy the block under each **▶ Paste this prompt** heading directly into Copilot Chat (or the GitHub Copilot CLI).
> Work through the steps in order — each one builds on the last.
> Expected time: ~20 minutes for a full walkthrough.

---

## Step 1 — Orient to the repo

**▶ Paste this prompt:**

```
I am a new developer on the `demo-app` Angular workspace. Here is the repo context:

- Angular 14 micro-frontend monorepo using Webpack Module Federation.
- Three projects: `demo-app` (host shell), `sub-app1` (remote, port 4201), `sub-app2` (remote, port 4202).
- State management: Redux + react-redux wired into the host via `StoreListenerService`.
- Test runner: Karma + Jasmine. Coverage via karma-coverage (Istanbul). Reports to `coverage/<project>/`.
- Architecture is documented in `docs/architecture.md` with three Mermaid diagrams.
- Key config: `angular.json` (all build targets), `src/webpack.config.js` (Module Federation host config), `scripts/karma.base.js` (shared Karma factory).
- CI: `.github/workflows/validate-docs.yml` validates Mermaid diagrams on every push.
- Contributing rules: `CONTRIBUTING.md`.

Please give me a 5-bullet orientation: what this app does, how the three projects relate, where state lives, how tests are run, and the single most important known gap I should be aware of.
```

---

## Step 2 — Understand the file layout

**▶ Paste this prompt:**

```
Still in the `demo-app` repo. Walk me through the key file paths I will touch day-to-day as a developer:

1. Where is the host shell bootstrapped?
2. Where is the Redux store defined, and how does the host shell consume it?
3. Where do I add a new route to lazy-load a remote micro-frontend?
4. Where is the shared Karma config, and how do I change a setting for all projects at once?
5. Where do I add a new environment variable so all three projects pick it up?

For each, give the exact file path and a one-sentence explanation of what to change.

Key files for reference:
- Host bootstrap: `src/main.ts`
- Host module: `src/app/app.module.ts`
- Host routing: `src/app/app-routing.module.ts`
- Store: `projects/sub-app1/store/store.ts`, exported via `projects/sub-app1/store/index.ts`
- Store listener (host): `src/app/store-listener.service.ts`
- Module Federation config: `src/webpack.config.js`
- Shared Karma factory: `scripts/karma.base.js`
- Root environment: `src/environments/environment.ts` (sub-apps re-export this)
- Architecture diagram: `docs/architecture.md`
```

---

## Step 3 — Run the project locally

**▶ Paste this prompt:**

```
I want to run the `demo-app` workspace locally for the first time. Give me the exact shell commands for each of these tasks, in order:

1. Install dependencies (note: `--legacy-peer-deps` is required due to peer dep conflicts between Angular 14 and react-redux).
2. Serve the host shell on its default port.
3. Serve `sub-app1` and `sub-app2` on ports 4201 and 4202 respectively (so Module Federation remotes are reachable).
4. Run all tests headlessly and see the coverage summary.
5. Validate the architecture diagrams without running tests.

Also tell me: what is missing before the remotes will actually render inside the host shell?
```

---

## Step 4 — Understand the test and coverage setup

**▶ Paste this prompt:**

```
Explain the test and coverage setup in `demo-app`:

- What test framework and runner are used?
- How is coverage instrumented? Where is the config that activates it?
- What reporters are configured, and where does each write its output?
- How do I run tests for only one project (e.g., sub-app1)?
- How do I add a coverage threshold so the build fails below a minimum?
- What is the current coverage for each project? (demo-app: Statements 87.5%, sub-app1: 100%, sub-app2: 100%)
- What is the one uncovered area in `demo-app` and why?

Shared Karma config lives in `scripts/karma.base.js`. Each project's `karma.conf.js` is a 4-line wrapper that calls this factory with its own `coverageDir`.
```

---

## Step 5 — Make your first change

**▶ Paste this prompt:**

```
I want to make my first real change to `demo-app`. Walk me through adding a simple counter feature to `sub-app1`:

1. A Redux action `INCREMENT` and reducer in `projects/sub-app1/store/store.ts`.
2. A `CounterComponent` in `projects/sub-app1/src/app/` that displays the count and has an Increment button.
3. A route in `projects/sub-app1/src/app/app-routing.module.ts` that exposes `CounterComponent` (and remove the TODO comment once done).
4. A matching lazy-loaded route in the host shell's `src/app/app-routing.module.ts` that loads it via Module Federation (remote alias `subapp1`, see `src/webpack.config.js`).
5. A spec file for `CounterComponent` that tests the increment behaviour.

For each file, show the diff — only the lines that change. After generating the diffs, tell me which commands to run to confirm nothing is broken.
```

---

## Step 6 — Open a PR

**▶ Paste this prompt:**

```
I have made changes on a branch called `feat/counter-component`. Help me open a pull request that meets the standards in `CONTRIBUTING.md`:

1. Suggest a PR title in Conventional Commits format.
2. Draft a PR description with: Summary, Files Changed table, Test Evidence section (placeholder for me to fill in after running `ng test --no-watch --browsers=ChromeHeadlessCI`), and a note about the route now being wired for Module Federation.
3. Give me the exact `gh` CLI command to create the PR.
4. Remind me of the pre-PR checklist from `CONTRIBUTING.md`.
```

---

## Step 7 — Explore the architecture diagram

**▶ Paste this prompt:**

```
Open `docs/architecture.md` and answer these questions based on the three Mermaid diagrams:

1. In the dependency flow diagram: which file is the single point that connects the host shell to both remotes? What would break if that file were deleted?
2. In the data flow diagram: at what step does the Redux store notify Angular? What is the role of `StoreListenerService`?
3. In the build/environment config flow: if I add a new property to `src/environments/environment.ts`, does it automatically appear in sub-app1 and sub-app2 builds? Why or why not?
4. What does the Known Issues table list, and which issue should be fixed before deploying to production?

After answering, tell me: does `docs/architecture.md` need to be updated to reflect the counter component added in Step 5? If so, which diagram(s) need a new node?
```

---

## Quick reference card

Paste this anywhere in Copilot Chat to get instant help on a specific topic:

```
I'm working in the `demo-app` Angular 14 Module Federation workspace.
Quick reference:
  Host shell       → src/  (bootstrap: src/main.ts)
  Remote 1         → projects/sub-app1/  (port 4201)
  Remote 2         → projects/sub-app2/  (port 4202)
  Redux store      → projects/sub-app1/store/store.ts
  Store in host    → src/app/store-listener.service.ts
  MF config        → src/webpack.config.js
  Karma factory    → scripts/karma.base.js
  Environments     → src/environments/  (sub-apps re-export from here)
  Architecture     → docs/architecture.md
  CI               → .github/workflows/validate-docs.yml
  Contributing     → CONTRIBUTING.md

[Your question here]
```
