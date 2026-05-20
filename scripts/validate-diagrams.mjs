#!/usr/bin/env node
/**
 * Extracts every ```mermaid``` block from docs/architecture.md,
 * writes each to a temp file, and runs mmdc --validate to confirm
 * the diagram parses without errors. Exits non-zero on any failure.
 */

import { exec } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DOC = join(REPO_ROOT, "docs", "architecture.md");
const MMDC = join(REPO_ROOT, "node_modules", ".bin", "mmdc");
const TMP = join(tmpdir(), "mermaid-validate-" + process.pid);

mkdirSync(TMP, { recursive: true });

// Puppeteer config: disable sandbox for CI environments
const puppeteerConfig = join(TMP, "puppeteer.json");
writeFileSync(
  puppeteerConfig,
  JSON.stringify({ args: ["--no-sandbox", "--disable-setuid-sandbox"] }),
  "utf8"
);

const source = readFileSync(DOC, "utf8");

// Extract all ```mermaid ... ``` blocks
const FENCE_RE = /```mermaid\r?\n([\s\S]*?)```/g;
const diagrams = [];
let match;
while ((match = FENCE_RE.exec(source)) !== null) {
  diagrams.push(match[1].trim());
}

if (diagrams.length === 0) {
  console.error("❌  No Mermaid diagrams found in", DOC);
  process.exit(1);
}

console.log(`🔍  Found ${diagrams.length} Mermaid diagram(s) in docs/architecture.md\n`);

// Render all diagrams in parallel — each has its own unique file paths so
// there is no collision. The puppeteer config is shared but read-only.
// Promise.all preserves insertion order, so result[i] === diagram i+1.
const results = await Promise.all(
  diagrams.map(async (diagram, i) => {
    const label = `Diagram ${i + 1}`;
    const inputFile = join(TMP, `diagram-${i + 1}.mmd`);
    const outputFile = join(TMP, `diagram-${i + 1}.svg`);
    writeFileSync(inputFile, diagram, "utf8");
    try {
      await execAsync(
        `"${MMDC}" --input "${inputFile}" --output "${outputFile}" --puppeteerConfigFile "${puppeteerConfig}"`
      );
      return { label, ok: true };
    } catch (err) {
      const stderr = err.stderr?.toString().trim() || err.message;
      return { label, ok: false, stderr };
    }
  })
);

// Clean up temp files before printing so exit() doesn't race the FS
rmSync(TMP, { recursive: true, force: true });

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ✅  ${r.label} — OK`);
  } else {
    console.error(`  ❌  ${r.label} — FAILED`);
    console.error(`      ${r.stderr.split("\n").join("\n      ")}`);
    failed++;
  }
}

console.log();
if (failed > 0) {
  console.error(`❌  ${failed} of ${diagrams.length} diagram(s) failed validation.`);
  process.exit(1);
} else {
  console.log(`✅  All ${diagrams.length} diagram(s) validated successfully.`);
}
