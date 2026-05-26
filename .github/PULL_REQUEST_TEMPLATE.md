## Patch plan

<!-- Scope, files changed, and expected outcome -->

**Ticket / Epic:**

**Problem being solved:**

**Files changed:**

| File | Change |
|---|---|
| | |

**Explicitly out of scope:**

---

## File scope

<!-- Folder or subsystem boundary this PR stays within -->

`src/app/___/` — changes are contained to this subsystem.

---

## Evidence

<!-- Before/after, test output, logs, or metrics that prove the change works -->

**Test run:**
```
# paste output here
```

**Before / After (if applicable):**

---

## Documentation

<!-- List any docs created or updated, or write N/A -->

---

## Rollback plan

```bash
# How to undo this PR completely
git revert <sha> --no-commit
git commit -m "revert: <description>"
```

**Verify rollback:**
```bash
ng test --no-watch --browsers=ChromeHeadlessCI
# Expected: X SUCCESS
```

---

## Delegation checklist

- [ ] Patch plan created (scope, files, expected outcome)
- [ ] File scope defined (folder or subsystem boundary)
- [ ] Diffs reviewed before committing
- [ ] Tests generated or updated
- [ ] Tests run and passing
- [ ] Documentation updated (if applicable)
- [ ] Evidence captured (before/after, logs, metrics)
- [ ] Rollback plan documented
- [ ] PR opened with template filled in
