#!/usr/bin/env node
/**
 * scripts/security-check.mjs
 *
 * Repeatable security hygiene check for the demo-app workspace.
 * Verifies three classes of controls and exits non-zero if any fail.
 *
 * Usage:
 *   node scripts/security-check.mjs          # full check
 *   node scripts/security-check.mjs --fix    # report only (no auto-fix; diffs are manual)
 *
 * Checks performed:
 *   1. audit-ci.json threshold gate   — high: true, critical: true must be set
 *   2. .gitignore secret patterns     — required patterns must be present
 *   3. Workflow permissions           — every workflow must declare permissions:
 *   4. audit-ci gate (live)           — runs npx audit-ci against the current tree
 *
 * Exit codes:
 *   0  All checks passed
 *   1  One or more checks failed (details printed to stdout)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── Helpers ───────────────────────────────────────────────────────────────────

let failures = 0;

function pass(msg)  { console.log(`  ✅  ${msg}`); }
function fail(msg)  { console.log(`  ❌  ${msg}`); failures++; }
function info(msg)  { console.log(`  ℹ️   ${msg}`); }
function section(t) { console.log(`\n── ${t} ${'─'.repeat(60 - t.length)}`); }

function readJson(rel) {
  const full = join(ROOT, rel);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function readText(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function workflowFiles() {
  const dir = join(ROOT, '.github', 'workflows');
  try {
    return readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch { return []; }
}

// ── Check 1: audit-ci.json threshold ─────────────────────────────────────────

section('Check 1: audit-ci.json threshold');

try {
  const cfg = readJson('audit-ci.json');

  if (cfg.high === true) {
    pass('high: true  — CI fails on new unlisted HIGH advisories');
  } else {
    fail('high is not true — new HIGH advisories will be silently missed in CI');
    info('Fix: set "high": true in audit-ci.json (ensure all current highs are allowlisted)');
  }

  if (cfg.critical === true) {
    pass('critical: true  — CI fails on new unlisted CRITICAL advisories');
  } else {
    fail('critical is not true');
  }

  const allowlist = cfg.allowlist ?? [];
  const rationale = cfg._allowlist_rationale ?? {};
  const missing = allowlist.filter(id => !rationale[id]);
  if (missing.length === 0) {
    pass(`All ${allowlist.length} allowlisted advisories have rationale entries`);
  } else {
    fail(`${missing.length} allowlisted advisory/ies lack rationale: ${missing.join(', ')}`);
    info('Fix: add an entry in _allowlist_rationale for each missing ID');
  }
} catch (e) {
  fail(`Could not read audit-ci.json: ${e.message}`);
}

// ── Check 2: .gitignore secret patterns ──────────────────────────────────────

section('Check 2: .gitignore secret patterns');

const REQUIRED_GITIGNORE_PATTERNS = [
  '.env',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
];

try {
  const gi = readText('.gitignore');
  for (const pattern of REQUIRED_GITIGNORE_PATTERNS) {
    if (gi.includes(pattern)) {
      pass(`Pattern present: ${pattern}`);
    } else {
      fail(`Missing pattern: ${pattern}  — secrets matching this glob could be committed`);
    }
  }
} catch (e) {
  fail(`Could not read .gitignore: ${e.message}`);
}

// ── Check 3: Workflow permissions ─────────────────────────────────────────────

section('Check 3: GitHub Actions workflow permissions');

for (const file of workflowFiles()) {
  const content = readText(join('.github', 'workflows', file));
  if (/^permissions:/m.test(content)) {
    pass(`${file}: top-level permissions: block present`);
  } else {
    fail(`${file}: no top-level permissions: block — defaults to repo write scope`);
    info(`Fix: add 'permissions:\\n  contents: read' at the top level of ${file}`);
  }
}

// ── Check 4: live audit-ci gate ───────────────────────────────────────────────

section('Check 4: Live audit-ci gate (npx audit-ci)');

try {
  execSync('npx audit-ci --config audit-ci.json', { cwd: ROOT, stdio: 'pipe' });
  pass('audit-ci gate passed — no unlisted advisories at or above configured threshold');
} catch (e) {
  fail('audit-ci gate FAILED — unlisted advisory detected');
  info('Run: npx audit-ci --config audit-ci.json  for full output');
  info('If the advisory is accepted risk, add it to allowlist + _allowlist_rationale in audit-ci.json');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(68)}`);
if (failures === 0) {
  console.log('✅  All security hygiene checks passed.');
} else {
  console.log(`❌  ${failures} check(s) failed. See above for fix instructions.`);
  process.exit(1);
}
