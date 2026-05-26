#!/usr/bin/env bash
# =============================================================================
# lint-autofix.sh — repeatable autofix for high-signal ESLint findings
# =============================================================================
#
# Applies the mechanical subset of the Tier 1.5 lint fixes that ESLint cannot
# auto-fix itself (type-aware rules don't have --fix support) using sed patterns
# that are safe to re-run idempotently.
#
# Usage:
#   bash scripts/lint-autofix.sh [--dry-run]
#
# --dry-run  Print the changes without writing them (uses `git diff` preview)
#
# Findings addressed:
#   F1  prefer-readonly   — add `readonly` to fields assigned only in ctor
#   F2  no-non-null-assertion — replace `ev!.prop` with `ev?.prop` in spec files
#   F3  snapshot-as-any   — replace `snapshot() as any` with spread `{ ...snapshot() }`
#
# Suppressions NOT auto-fixed (require human judgement):
#   prefer-inject  — Angular 14 constructor injection is correct; Angular 16+ only
#   no-unnecessary-condition (feature-flag ?? false) — intentional unknown-key safety
#
# Requires: bash 4+, sed (BSD or GNU), git (for --dry-run diff)
# =============================================================================

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

info()  { echo "  ✓ $*"; }
skip()  { echo "  ~ $* (already fixed)"; }
error() { echo "  ✗ $*" >&2; }

# ─── helper ──────────────────────────────────────────────────────────────────
apply_sed() {
  local file="$1"; shift
  local pattern="$1"; shift
  local replacement="$1"

  if grep -qE "$pattern" "$file" 2>/dev/null; then
    if $DRY_RUN; then
      echo "  [dry-run] would patch $file"
      sed -E "s/$pattern/$replacement/g" "$file" | diff "$file" - || true
    else
      sed -i.bak -E "s/$pattern/$replacement/g" "$file" && rm -f "${file}.bak"
      info "Patched: $file"
    fi
  else
    skip "$file — pattern not found (already clean)"
  fi
}

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  lint-autofix.sh — Tier 1.5 mechanical fixes      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ─── F1: prefer-readonly ─────────────────────────────────────────────────────
# Pattern: `private unsubscribe: Unsubscribe;` → `private readonly unsubscribe: Unsubscribe;`
# Safe because the field is only assigned once in the constructor.
echo "[F1] prefer-readonly — store-listener.service.ts"
apply_sed \
  "src/app/store-listener.service.ts" \
  "private unsubscribe: Unsubscribe" \
  "private readonly unsubscribe: Unsubscribe"

# ─── F2: no-non-null-assertion in web-vitals spec ────────────────────────────
# Pattern: `ev!.` → `ev?.` — safe because expect(ev).toBeTruthy() precedes each use.
echo "[F2] no-non-null-assertion — web-vitals.service.spec.ts"
apply_sed \
  "src/app/telemetry/web-vitals.service.spec.ts" \
  "ev\!\.([a-zA-Z])" \
  "ev?.\1"

# Also fix telemetry.service.spec.ts capturedBlob! pattern
echo "[F2] no-non-null-assertion — telemetry.service.spec.ts"
apply_sed \
  "src/app/telemetry/telemetry.service.spec.ts" \
  "capturedBlob\!\.type" \
  "capturedBlob?.type"

# ─── F3: snapshot() as any → spread ─────────────────────────────────────────
# Pattern: removes `as any` cast and eslint-disable comment for snapshot mutation tests.
# The spread creates a mutable writable copy without bypassing the type system.
echo "[F3] snapshot-as-any — feature-flag.service.spec.ts"
TARGET="src/app/feature-flags/feature-flag.service.spec.ts"
if grep -q "snapshot() as any" "$TARGET" 2>/dev/null; then
  if $DRY_RUN; then
    echo "  [dry-run] would replace 'snapshot() as any' with '{ ...service.snapshot() }'"
  else
    # Remove the eslint-disable comment line above and fix the cast
    sed -i.bak \
      '/eslint-disable-next-line @typescript-eslint\/no-explicit-any/{N;/snapshot() as any/d}' \
      "$TARGET"
    sed -i.bak \
      's/= service\.snapshot() as any/= { ...service.snapshot() }/' \
      "$TARGET"
    rm -f "${TARGET}.bak"
    info "Patched: $TARGET"
  fi
else
  skip "$TARGET — snapshot() as any not found (already clean)"
fi

# ─── Final lint check ────────────────────────────────────────────────────────
echo ""
echo "Running lint to verify..."
if npm run lint -- --max-warnings 10 2>&1 | grep -q "0 errors"; then
  echo "  ✅ Lint clean (0 errors)"
else
  npm run lint -- --max-warnings 50 2>&1 | grep -E "error|warning|problem" | tail -5
fi

echo ""
echo "Done. Run 'npm run lint' to confirm, 'npx ng test demo-app' to validate."
