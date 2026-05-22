# Architecture Overview

This workspace is an **Angular 14 micro-frontend** application using **Webpack Module Federation**. It consists of one host shell (`demo-app`) and two remote applications (`sub-app1`, `sub-app2`).

---

## Project Structure Map

| Conceptual Role | Project Name | Root Path |
|---|---|---|
| Host / Shell | `demo-app` | `src/` |
| Remote 1 | `sub-app1` | `projects/sub-app1/` |
| Remote 2 | `sub-app2` | `projects/sub-app2/` |

### Key File Paths

| Artifact | File Path |
|---|---|
| Workspace config | `angular.json` |
| Host bootstrap | `src/main.ts` |
| Host root module | `src/app/app.module.ts` |
| Host router | `src/app/app-routing.module.ts` |
| Host root component | `src/app/app.component.ts` |
| Host MF config | `src/webpack.config.js` |
| Host environment (dev) | `src/environments/environment.ts` |
| Host environment (prod) | `src/environments/environment.prod.ts` |
| Host global styles | `src/styles.css` |
| Host test entry | `src/test.ts` |
| sub-app1 bootstrap | `projects/sub-app1/src/main.ts` |
| sub-app1 root module | `projects/sub-app1/src/app/app.module.ts` |
| sub-app1 router | `projects/sub-app1/src/app/app-routing.module.ts` |
| sub-app1 root component | `projects/sub-app1/src/app/app.component.ts` |
| sub-app1 Redux store | `projects/sub-app1/store/store.ts` |
| sub-app1 store index | `projects/sub-app1/store/index.ts` |
| sub-app2 bootstrap | `projects/sub-app2/src/main.ts` |
| sub-app2 root module | `projects/sub-app2/src/app/app.module.ts` |
| sub-app2 router | `projects/sub-app2/src/app/app-routing.module.ts` |
| sub-app2 root component | `projects/sub-app2/src/app/app.component.ts` |

---

## Dependency Flow

How the host shell resolves and loads remote micro-frontends at runtime via Module Federation.

```mermaid
graph TD
    subgraph Host ["demo-app (Host Shell)"]
        A["src/index.html"] --> B["src/main.ts"]
        B --> C["src/app/app.module.ts"]
        C --> D["src/app/app-routing.module.ts"]
        C --> E["src/app/app.component.ts"]
        B --> F["src/environments/environment.ts"]
        WC["src/webpack.config.js\n(ModuleFederationPlugin)\nname: 'root'"] --> RE1
        WC --> RE2
    end

    subgraph Remote1 ["sub-app1 (Remote, :4201)"]
        RE1["remoteEntry.js\n→ projects/sub-app1/src/main.ts"] --> M1["projects/sub-app1/src/app/app.module.ts"]
        M1 --> R1["projects/sub-app1/src/app/app-routing.module.ts"]
        M1 --> AC1["projects/sub-app1/src/app/app.component.ts"]
    end

    subgraph Remote2 ["sub-app2 (Remote, :4202)"]
        RE2["remoteEntry.js\n→ projects/sub-app2/src/main.ts"] --> M2["projects/sub-app2/src/app/app.module.ts"]
        M2 --> R2["projects/sub-app2/src/app/app-routing.module.ts"]
        M2 --> AC2["projects/sub-app2/src/app/app.component.ts"]
    end

    D -->|"lazy loads via\nsubapp1@http://localhost:4201"| RE1
    D -->|"lazy loads via\nsubapp2@http://localhost:4202"| RE2
```

> **Note:** `sub-app1` and `sub-app2` are missing their own `webpack.config.js` files to expose `remoteEntry.js`. These need to be created for Module Federation to work end-to-end.

---

## Data Flow

How state is managed in `sub-app1` using Redux (`redux` + `react-redux`) and surfaced to Angular components.

```mermaid
sequenceDiagram
    participant User
    participant AppComponent as sub-app1<br/>app.component.ts
    participant Store as Redux Store<br/>store/store.ts
    participant StoreIndex as store/index.ts
    participant AppModule as sub-app1<br/>app.module.ts

    User->>AppComponent: Interaction (click / input)
    AppComponent->>Store: dispatch(action)
    Store->>Store: reducer processes action<br/>→ new state
    Store-->>AppComponent: selector / subscribe returns new state
    AppComponent-->>User: Re-render with updated data

    Note over AppModule: Provides Redux store<br/>to component tree via<br/>StoreIndex (re-exports store)
    AppModule->>StoreIndex: imports store config
    StoreIndex->>Store: initializes store.ts
```

> **Note:** `store/store.ts` and `store/index.ts` are currently empty — Redux store configuration and reducers still need to be implemented.

---

## Build & Environment Config Flow

```mermaid
graph LR
    AJ["angular.json"] -->|"main: src/main.ts\nindex: src/index.html"| HOST["demo-app build"]
    AJ -->|"main: projects/sub-app1/src/main.ts"| SA1["sub-app1 build"]
    AJ -->|"main: projects/sub-app2/src/main.ts"| SA2["sub-app2 build"]

    HOST -->|"production"| EP["src/environments/environment.prod.ts\n(fileReplacement)"]
    HOST -->|"development"| ED["src/environments/environment.ts"]

    SA1 -->|"production"| EP1["projects/sub-app1/src/environments/environment.prod.ts"]
    SA2 -->|"production"| EP2["projects/sub-app2/src/environments/environment.prod.ts"]

    HOST --> OUT1["dist/demo-app/"]
    SA1 --> OUT2["dist/sub-app1/"]
    SA2 --> OUT3["dist/sub-app2/"]
```

---


---

## Telemetry Subsystem — Dependency Graph

> **Auto-generated** by `scripts/gen-architecture.mjs`.
> Run `npm run gen:architecture` to refresh after changing `src/app/telemetry/`.

<!-- telemetry-diagram -->
```mermaid
graph TD
    subgraph Telemetry ["src/app/telemetry/ — Telemetry Subsystem"]
        resilience_ts(["Resilience\n(resilience.ts)"])
        router_telemetry_service_ts["Router Telemetry.Svc\n(router-telemetry.service.ts)"]
        telemetry_error_handler_ts["Telemetry Error Hdlr\n(telemetry-error-handler.ts)"]
        telemetry_flush_service_ts["Telemetry Flush.Svc\n(telemetry-flush.service.ts)"]
        telemetry_service_ts["Telemetry.Svc\n(telemetry.service.ts)"]
        web_vitals_service_ts["Web Vitals.Svc\n(web-vitals.service.ts)"]
        router_telemetry_service_ts --> telemetry_service_ts
        telemetry_error_handler_ts --> telemetry_service_ts
        telemetry_flush_service_ts --> telemetry_service_ts
        telemetry_service_ts --> resilience_ts
        web_vitals_service_ts --> telemetry_service_ts
        web_vitals_service_ts --> resilience_ts
    end

    ext_web_vitals(["web-vitals\n(external)"]):::external
    web_vitals_service_ts -.->|uses| ext_web_vitals

    env["environment.ts\n(telemetryEndpoint)"]:::config
    telemetry_flush_service_ts -->|reads endpoint| env

    AppModule["AppModule\n(app.module.ts)"]:::caller
    AppModule -->|provides| router_telemetry_service_ts
    AppModule -->|provides| telemetry_error_handler_ts
    AppModule -->|provides| telemetry_flush_service_ts
    AppModule -->|provides| web_vitals_service_ts

    classDef external fill:#f5f0e8,stroke:#c9a84c,color:#333
    classDef config fill:#e8f0fe,stroke:#4a86e8,color:#333
    classDef caller fill:#e8f5e9,stroke:#43a047,color:#333
```
<!-- /telemetry-diagram -->

## Known Issues & Gaps

| # | Issue | Location |
|---|---|---|
| 1 | `sub-app1` and `sub-app2` have no `webpack.config.js` — cannot expose `remoteEntry.js` | `projects/sub-app1/src/`, `projects/sub-app2/src/` |
| 2 | Host `AppModule` declares `[Provider]` (react-redux) in `declarations` — should be in `imports` or `providers` | `src/app/app.module.ts` |
| 3 | Redux store files are empty | `projects/sub-app1/store/store.ts`, `store/index.ts` |
| 4 | `AppRoutingModule` in host has no routes — remotes are not wired for lazy loading | `src/app/app-routing.module.ts` |

---

## Architecture Change Summary

### 2026-05-22 (977e2f9)

**Initial generation** — telemetry subsystem diagram created from scratch.

Nodes discovered: 7
Dependency edges: 6
