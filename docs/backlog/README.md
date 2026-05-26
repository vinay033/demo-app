# Telemetry Subsystem Backlog

_Generated: 2026-05-26 | Subsystem: `src/app/telemetry/`_

## Open improvement issues

| # | Title | Priority | Effort | Labels |
|---|---|---|---|---|
| [#14](https://github.com/vinay033/demo-app/issues/14) | `TelemetryErrorHandler` records metrics even when `enableTelemetry` is OFF | High (bug) | ~30 min | bug, good first issue |
| [#15](https://github.com/vinay033/demo-app/issues/15) | Gate `_emit()` `console.log` behind `isDevMode()` | Medium | ~20 min | enhancement, good first issue |
| [#16](https://github.com/vinay033/demo-app/issues/16) | Decouple `StoreListenerService` from sub-app1 store via `InjectionToken` | Medium | ~1 hr | enhancement, architecture |
| [#17](https://github.com/vinay033/demo-app/issues/17) | Add periodic flush to prevent data loss on long SPA sessions | Medium | ~1 hr | enhancement, reliability |
| [#18](https://github.com/vinay033/demo-app/issues/18) | Return `CancelRetry` handle from `scheduleBeaconRetry` | Low | ~1.5 hr | enhancement, reliability |

## Good first tasks (agent-delegatable)

Issues #14 and #15 are ideal for delegation:
- Single file each, clear pattern to follow, test template provided
- No cross-cutting refactor risk

See [`issue-14-patch-plan.md`](./issue-14-patch-plan.md) for the full simulated patch plan including diff, test template, risk assessment, and exact commit/PR commands.

## Suggested implementation order

1. **#14** (bug fix — flag guard consistency)  
2. **#15** (quick win — production log noise)  
3. **#16** (architecture — InjectionToken decoupling)  
4. **#17** (reliability — periodic flush)  
5. **#18** (reliability — retry cancellation, highest complexity)
