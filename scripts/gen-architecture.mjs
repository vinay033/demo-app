#!/usr/bin/env node
/**
 * scripts/gen-architecture.mjs
 *
 * Regenerates the "Telemetry Subsystem" Mermaid diagram in docs/architecture.md
 * by scanning src/app/telemetry/ for source files and deriving dependency edges
 * from their import statements.
 *
 * Usage:
 *   node scripts/gen-architecture.mjs           # update docs/architecture.md in-place
 *   node scripts/gen-architecture.mjs --dry-run  # print proposed diagram, do not write
 *   node scripts/gen-architecture.mjs --summary  # also print change summary to stdout
 *
 * The script:
 *   1. Reads the current docs/architecture.md (captures "before" state)
 *   2. Scans src/app/telemetry/*.ts (excluding *.spec.ts) for imports
 *   3. Builds a directed dependency graph from the import lines
 *   4. Renders a Mermaid flowchart for the telemetry subsystem
 *   5. Replaces the <!-- telemetry-diagram --> … <!-- /telemetry-diagram -->
 *      block in docs/architecture.md with the fresh diagram
 *   6. Appends a dated entry to the ## Change Summary section
 *   7. Writes the file back (unless --dry-run)
 *
 * Trigger in CI or via git hook:
 *   When any file matching src/app/telemetry/**\/*.ts changes, run this script
 *   and commit the result. See .github/workflows/update-architecture.yml.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, relative, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TELEMETRY_DIR = resolve(ROOT, 'src/app/telemetry');
const ARCH_DOC = resolve(ROOT, 'docs/architecture.md');

const isDryRun = process.argv.includes('--dry-run');
const printSummary = process.argv.includes('--summary') || isDryRun;

// ── 1. Capture "before" state ───────────────────────────────────────────────

const before = readFileSync(ARCH_DOC, 'utf8');

// ── 2. Scan telemetry source files ───────────────────────────────────────────

/** Friendly display name for a file basename */
function label(file) {
  return file
    .replace(/\.ts$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace('Service', 'Svc')
    .replace('Handler', 'Hdlr');
}

/** Node ID safe for Mermaid (no dots, slashes, or special chars) */
function nodeId(file) {
  return file.replace(/[^a-zA-Z0-9]/g, '_').replace(/\.ts$/, '');
}

const sourceFiles = readdirSync(TELEMETRY_DIR)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
  .sort();

/**
 * Parse intra-module imports from a file.
 * Returns array of { from: string, to: string } (both are file basenames).
 */
function parseImports(file) {
  const content = readFileSync(resolve(TELEMETRY_DIR, file), 'utf8');
  const edges = [];

  // Match: import { ... } from './something'
  const re = /from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    // Only intra-module imports (start with ./)
    if (!raw.startsWith('./')) continue;
    const target = basename(raw) + '.ts';
    if (sourceFiles.includes(target)) {
      edges.push({ from: file, to: target });
    }
  }
  return edges;
}

const allEdges = sourceFiles.flatMap(parseImports);

// ── 3. Detect external dependencies (non-Angular, non-intra-module) ──────────

function externalDeps(file) {
  const content = readFileSync(resolve(TELEMETRY_DIR, file), 'utf8');
  const deps = new Set();
  const re = /from\s+['"]([^'"./][^'"]*)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const pkg = m[1].split('/')[0];
    if (!pkg.startsWith('@angular') && !pkg.startsWith('rxjs')) {
      deps.add(pkg);
    }
  }
  return [...deps];
}

const extDeps = {};
for (const f of sourceFiles) {
  const deps = externalDeps(f);
  if (deps.length) extDeps[f] = deps;
}

// ── 4. Render Mermaid diagram ─────────────────────────────────────────────────

function renderDiagram() {
  const lines = [];
  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('    subgraph Telemetry ["src/app/telemetry/ — Telemetry Subsystem"]');

  // Nodes
  for (const f of sourceFiles) {
    const id = nodeId(f);
    const lbl = label(f);
    // classify node shape: service = rounded, utility = stadium, handler = hexagon
    if (f.includes('.service.ts')) {
      lines.push(`        ${id}["${lbl}\\n(${f})"]`);
    } else if (f === 'resilience.ts') {
      lines.push(`        ${id}(["${lbl}\\n(${f})"])`);
    } else {
      lines.push(`        ${id}["${lbl}\\n(${f})"]`);
    }
  }

  // Intra-module edges
  for (const { from, to } of allEdges) {
    lines.push(`        ${nodeId(from)} --> ${nodeId(to)}`);
  }

  lines.push('    end');
  lines.push('');

  // External dependency nodes
  const allExt = [...new Set(Object.values(extDeps).flat())];
  for (const dep of allExt) {
    const id = 'ext_' + dep.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`    ${id}(["${dep}\\n(external)"]):::external`);
  }

  // External edges
  for (const [file, deps] of Object.entries(extDeps)) {
    for (const dep of deps) {
      const extId = 'ext_' + dep.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`    ${nodeId(file)} -.->|uses| ${extId}`);
    }
  }

  // Environment dependency
  const flushFile = 'telemetry-flush.service.ts';
  if (sourceFiles.includes(flushFile)) {
    lines.push('');
    lines.push(`    env["environment.ts\\n(telemetryEndpoint)"]:::config`);
    lines.push(`    ${nodeId(flushFile)} -->|reads endpoint| env`);
  }

  // AppModule / caller node
  lines.push('');
  lines.push('    AppModule["AppModule\\n(app.module.ts)"]:::caller');
  const rootServices = sourceFiles.filter(f => {
    const isTarget = allEdges.some(e => e.to === f);
    return !isTarget; // services nobody depends on internally = roots = wired by AppModule
  });
  for (const f of rootServices) {
    lines.push(`    AppModule -->|provides| ${nodeId(f)}`);
  }

  lines.push('');
  lines.push('    classDef external fill:#f5f0e8,stroke:#c9a84c,color:#333');
  lines.push('    classDef config fill:#e8f0fe,stroke:#4a86e8,color:#333');
  lines.push('    classDef caller fill:#e8f5e9,stroke:#43a047,color:#333');
  lines.push('```');

  return lines.join('\n');
}

const freshDiagram = renderDiagram();

// ── 5. Diff: what changed? ────────────────────────────────────────────────────

/**
 * Extract the content of the managed diagram block from the doc.
 * Returns empty string if the block does not yet exist.
 */
function extractBlock(doc) {
  const start = doc.indexOf('<!-- telemetry-diagram -->');
  const end = doc.indexOf('<!-- /telemetry-diagram -->');
  if (start === -1 || end === -1) return '';
  return doc.slice(start + '<!-- telemetry-diagram -->'.length, end).trim();
}

const previousDiagram = extractBlock(before);

function buildChangeSummary(prev, next) {
  const prevNodes = (prev.match(/\w+\["[^"]+"\]/g) || []).map(s => s.split('[')[0]);
  const nextNodes = (next.match(/\w+\["[^"]+"\]/g) || []).map(s => s.split('[')[0]);
  const prevEdges = prev.match(/\w+ --[>.]+\|?[^|]*\|? \w+/g) || [];
  const nextEdges = next.match(/\w+ --[>.]+\|?[^|]*\|? \w+/g) || [];

  const addedNodes = nextNodes.filter(n => !prevNodes.includes(n));
  const removedNodes = prevNodes.filter(n => !nextNodes.includes(n));
  const addedEdges = nextEdges.filter(e => !prevEdges.includes(e));
  const removedEdges = prevEdges.filter(e => !nextEdges.includes(e));

  const now = new Date().toISOString().slice(0, 10);
  let sha = '';
  try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}

  const lines = [];
  lines.push(`### ${now} (${sha || 'local'})`);
  lines.push('');

  if (!prev) {
    lines.push('**Initial generation** — telemetry subsystem diagram created from scratch.');
    lines.push('');
    lines.push(`Nodes discovered: ${nextNodes.length}`);
    lines.push(`Dependency edges: ${nextEdges.length}`);
  } else {
    const hasChanges = addedNodes.length || removedNodes.length || addedEdges.length || removedEdges.length;
    if (!hasChanges) {
      lines.push('No structural changes detected — diagram is up to date.');
    } else {
      if (addedNodes.length) {
        lines.push(`**Added nodes (${addedNodes.length}):** ${addedNodes.join(', ')}`);
      }
      if (removedNodes.length) {
        lines.push(`**Removed nodes (${removedNodes.length}):** ${removedNodes.join(', ')}`);
      }
      if (addedEdges.length) {
        lines.push(`**Added edges (${addedEdges.length}):** ${addedEdges.join('; ')}`);
      }
      if (removedEdges.length) {
        lines.push(`**Removed edges (${removedEdges.length}):** ${removedEdges.join('; ')}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

const changeSummary = buildChangeSummary(previousDiagram, freshDiagram);

// ── 6. Build the new section ──────────────────────────────────────────────────

const SECTION_HEADER = `
---

## Telemetry Subsystem — Dependency Graph

> **Auto-generated** by \`scripts/gen-architecture.mjs\`.
> Run \`npm run gen:architecture\` to refresh after changing \`src/app/telemetry/\`.

<!-- telemetry-diagram -->
`;

const SECTION_FOOTER = `
<!-- /telemetry-diagram -->
`;

const CHANGELOG_MARKER = '## Architecture Change Summary';

function buildNewDoc(doc, diagram, summary) {
  // Replace or insert the managed diagram block
  const startMarker = '<!-- telemetry-diagram -->';
  const endMarker = '<!-- /telemetry-diagram -->';

  let updated;
  if (doc.includes(startMarker)) {
    // Block already exists — replace content between markers
    const before = doc.slice(0, doc.indexOf(startMarker) + startMarker.length);
    const after = doc.slice(doc.indexOf(endMarker));
    updated = before + '\n' + diagram + '\n' + after;
  } else {
    // First run — append the entire section before the Known Issues section
    const insertBefore = '## Known Issues';
    const idx = doc.indexOf(insertBefore);
    const inject = SECTION_HEADER + diagram + SECTION_FOOTER + '\n';
    updated = idx !== -1
      ? doc.slice(0, idx) + inject + doc.slice(idx)
      : doc + '\n' + inject;
  }

  // Append/update the change log section
  if (updated.includes(CHANGELOG_MARKER)) {
    // Insert new entry after the marker heading
    const markerIdx = updated.indexOf(CHANGELOG_MARKER) + CHANGELOG_MARKER.length;
    updated = updated.slice(0, markerIdx) + '\n\n' + summary + updated.slice(markerIdx);
  } else {
    updated += `\n---\n\n${CHANGELOG_MARKER}\n\n${summary}`;
  }

  return updated;
}

const newDoc = buildNewDoc(before, freshDiagram, changeSummary);

// ── 7. Output ─────────────────────────────────────────────────────────────────

if (isDryRun) {
  console.log('=== DRY RUN — proposed diagram ===\n');
  console.log(freshDiagram);
  console.log('\n=== Change Summary ===\n');
  console.log(changeSummary);
  console.log('\n(Not written — re-run without --dry-run to apply)');
} else {
  writeFileSync(ARCH_DOC, newDoc, 'utf8');
  console.log(`✔ docs/architecture.md updated`);
  if (printSummary) {
    console.log('\n=== Change Summary ===\n');
    console.log(changeSummary);
  }
}
