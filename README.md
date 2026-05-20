# DemoApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 14.0.5.

## Project docs

| Document | Description |
|---|---|
| [Architecture](./docs/architecture.md) | Mermaid diagrams: dependency flow, data flow, build/env config |
| [Onboarding walk](./docs/onboarding-walk.md) | Step-by-step Copilot Chat prompts for new developers |
| [Contributing](./CONTRIBUTING.md) | Branching strategy, PR expectations, Copilot guidance |
| [Security](./SECURITY.md) | Vulnerability scanning process, known accepted risks, upgrade path |
| [Telemetry](./docs/telemetry.md) | Instrumentation points, how to view metrics (DevTools, staging, prod backends) |
| [Feature Flags](./docs/feature-flags.md) | Flag lifecycle: creation, defaults, enable, disable, removal checklist |
| [Static Analysis](./docs/static-analysis.md) | ESLint tiers, strict rules for telemetry module, how to add rules |

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running coverage locally

This workspace has three independently testable projects. Coverage is enabled by default (`codeCoverage: true` in `angular.json`) and reports are written to `coverage/` after each run.

### Quick start — all projects, headless

```bash
# demo-app (host shell)
ng test --no-watch --browsers=ChromeHeadlessCI

# sub-app1 (remote)
ng test sub-app1 --no-watch --browsers=ChromeHeadlessCI

# sub-app2 (remote)
ng test sub-app2 --no-watch --browsers=ChromeHeadlessCI
```

### Interactive mode (watch + browser UI)

```bash
ng test              # demo-app — opens Chrome, watches for file changes
ng test sub-app1     # sub-app1
ng test sub-app2     # sub-app2
```

### Coverage output locations

| Project | HTML report | lcov (for CI tools) |
|---|---|---|
| `demo-app` | `coverage/demo-app/index.html` | `coverage/demo-app/lcov.info` |
| `sub-app1` | `coverage/sub-app1/index.html` | `coverage/sub-app1/lcov.info` |
| `sub-app2` | `coverage/sub-app2/index.html` | `coverage/sub-app2/lcov.info` |

Open the HTML report in a browser for a line-by-line breakdown:

```bash
open coverage/demo-app/index.html   # macOS
xdg-open coverage/demo-app/index.html  # Linux
```

### Enforcing a coverage threshold

Pass `--code-coverage-exclude` and Angular CLI flags, or add `thresholds` directly in `karma.conf.js`:

```js
// karma.conf.js
coverageReporter: {
  ...
  check: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
}
```

The build will fail if coverage drops below the configured thresholds.

### Validating architecture diagrams

The [`docs/architecture.md`](./docs/architecture.md) Mermaid diagrams are validated by [`scripts/validate-diagrams.mjs`](./scripts/validate-diagrams.mjs):

```bash
npm run validate:docs
```

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

For contributing guidelines, branching strategy, and how to use GitHub Copilot with this repo, see [CONTRIBUTING.md](./CONTRIBUTING.md).
