#!/usr/bin/env node
/**
 * Extracts every ```mermaid``` block from docs/architecture.md,
 * writes each to a temp file, and runs mmdc --validate to confirm
 * the diagram parses without errors. Exits non-zero on any failure.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

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

let failed = 0;

for (let i = 0; i < diagrams.length; i++) {
  const label = `Diagram ${i + 1}`;
  const inputFile = join(TMP, `diagram-${i + 1}.mmd`);
  const outputFile = join(TMP, `diagram-${i + 1}.svg`);

  writeFileSync(inputFile, diagrams[i], "utf8");

  try {
    execSync(
      `"${MMDC}" --input "${inputFile}" --output "${outputFile}" --puppeteerConfigFile "${puppeteerConfig}"`,
      { stdio: "pipe" }
    );
    console.log(`  ✅  ${label} — OK`);
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || err.message;
    console.error(`  ❌  ${label} — FAILED`);
    console.error(`      ${stderr.split("\n").join("\n      ")}`);
    failed++;
  }
}

// Clean up temp files
rmSync(TMP, { recursive: true, force: true });

console.log();
if (failed > 0) {
  console.error(`❌  ${failed} of ${diagrams.length} diagram(s) failed validation.`);
  process.exit(1);
} else {
  console.log(`✅  All ${diagrams.length} diagram(s) validated successfully.`);
}
