#!/usr/bin/env node
/**
 * Builds catalog/MW-XXXX/index.json (and any markdown attachments) for every
 * ClickUp task summary found under click-up/tasks/MW-XXXX/.
 *
 * Usage:
 *   npx tsx src/cli/build-catalog.ts
 *   npx tsx src/cli/build-catalog.ts --dry-run
 *   npx tsx src/cli/build-catalog.ts --ids MW-1001,MW-1005
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { buildCatalogItem } from "../lib/catalog-build.js";
import type { CatalogItemResult } from "../lib/catalog-build.js";
import type { ClickUpTaskSummary } from "../lib/clickup-utils.js";
import { assertCatalogItemResult, ValidationWarning } from "../lib/catalog-validate.js";
import { EVER_MARKETPLACE_CATEGORY_NAMES, type IEverMarketplaceCatalog, type IEverMarketplaceCatalogItem, type IEverMarketplaceVersion } from "../model/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TASKS_DIR = path.join(ROOT, "click-up/tasks");
const CATALOG_DIR = path.join(ROOT, "catalog");
const REPORTS_DIR = path.join(ROOT, "reports");

// ── types ─────────────────────────────────────────────────────────────────────

type TaskSuccess = { status: "success"; id: string; name: string; warnings: ValidationWarning[]; item: IEverMarketplaceCatalogItem };
type TaskFailure = { status: "failure"; id: string; reason: string };
type TaskResult = TaskSuccess | TaskFailure;

// ── task processing ───────────────────────────────────────────────────────────

function processTask(taskId: string, dryRun: boolean): TaskResult {
    const summaryPath = path.join(TASKS_DIR, taskId, `${taskId}-summary.json`);

    if (!fs.existsSync(summaryPath)) {
        console.warn(`  [skip] No summary JSON for ${taskId}`);
        return { status: "failure", id: taskId, reason: "No summary JSON found" };
    }

    let summary: ClickUpTaskSummary;
    try {
        summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as ClickUpTaskSummary;
    } catch (err) {
        console.error(`  [error] Failed to parse ${summaryPath}: ${err}`);
        return { status: "failure", id: taskId, reason: `Failed to parse summary JSON: ${err}` };
    }

    let result: CatalogItemResult;
    let warnings: ValidationWarning[] = [];
    try {
        result = buildCatalogItem(summary);
        const validationResult = assertCatalogItemResult(result);
        warnings = validationResult.warnings;
    } catch (err) {
        console.error(`  [error] buildCatalogItem failed for ${taskId}: ${err}`);
        return { status: "failure", id: taskId, reason: `Build failed: ${err}` };
    }

    const outDir = path.join(CATALOG_DIR, taskId);
    const indexPath = path.join(outDir, "index.json");

    if (dryRun) {
        console.log(`  [dry-run] Would write: ${indexPath}`);
        for (const filename of Object.keys(result.attachments)) {
            console.log(`  [dry-run] Would write: ${path.join(outDir, filename)}`);
        }
        console.log(JSON.stringify(result.item, null, 2).slice(0, 500) + "...");
    } else {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(indexPath, JSON.stringify(result.item, null, 2) + "\n");
        for (const [filename, content] of Object.entries(result.attachments)) {
            fs.writeFileSync(path.join(outDir, filename), content);
        }
        console.log(`  ✓ ${taskId}: ${summary.name}`);
    }

    return { status: "success", id: taskId, name: summary.name, warnings, item: result.item };
}

// ── report generation ─────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function generateHtml(results: TaskResult[], date: string, dryRun: boolean): string {
    const successes = results.filter((r): r is TaskSuccess => r.status === "success");
    const failures  = results.filter((r): r is TaskFailure => r.status === "failure");
    const withWarnings = successes.filter(r => r.warnings.length > 0);
    const totalWarnings = successes.reduce((n, r) => n + r.warnings.length, 0);

    const successRows = successes.map(r => {
        const badge = r.warnings.length > 0
            ? ` <span class="warn-badge">${r.warnings.length}</span>`
            : "";
        return `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}${badge}</td></tr>`;
    }).join("\n");

    const failureRows = failures.map(r =>
        `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.reason)}</td></tr>`,
    ).join("\n");

    const warningRows = withWarnings.flatMap(r =>
        r.warnings.map(w =>
            `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(w.field)}</td><td>${escapeHtml(w.message)}</td></tr>`,
        ),
    ).join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Catalog Build Report – ${escapeHtml(date)}</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 2rem auto; color: #222; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
    .summary { display: flex; gap: 2rem; margin: 1rem 0; }
    .stat { padding: 0.5rem 1rem; border-radius: 4px; font-weight: bold; }
    .stat-total   { background: #e8e8e8; }
    .stat-success { background: #d4edda; color: #155724; }
    .stat-warning { background: #fff3cd; color: #856404; }
    .stat-failure { background: #f8d7da; color: #721c24; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 0.4rem 0.6rem; background: #f0f0f0; border-bottom: 2px solid #ccc; }
    td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    td:first-child { white-space: nowrap; font-family: monospace; }
    tr:hover td { background: #fafafa; }
    .warn-badge { display: inline-block; background: #ffc107; color: #000; border-radius: 10px;
                  font-size: 0.75rem; font-weight: bold; padding: 0 0.4rem; margin-left: 0.4rem; }
  </style>
</head>
<body>
  <h1>Catalog Build Report${dryRun ? " (dry-run)" : ""}</h1>
  <p>Generated: ${escapeHtml(date)}</p>
  <div class="summary">
    <span class="stat stat-total">Total: ${results.length}</span>
    <span class="stat stat-success">Success: ${successes.length}</span>
    <span class="stat stat-warning">Warnings: ${totalWarnings}</span>
    <span class="stat stat-failure">Failed: ${failures.length}</span>
  </div>

  <h2>Successfully Built (${successes.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Name</th></tr></thead>
    <tbody>${successRows || "<tr><td colspan=\"2\">None</td></tr>"}</tbody>
  </table>

  <h2>Warnings (${totalWarnings})</h2>
  <table>
    <thead><tr><th>ID</th><th>Field</th><th>Message</th></tr></thead>
    <tbody>${warningRows || "<tr><td colspan=\"3\">None</td></tr>"}</tbody>
  </table>

  <h2>Failed (${failures.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Reason</th></tr></thead>
    <tbody>${failureRows || "<tr><td colspan=\"2\">None</td></tr>"}</tbody>
  </table>
</body>
</html>
`;
}

// ── main ──────────────────────────────────────────────────────────────────────

function main(): void {
    program
        .option("--dry-run", "preview changes without writing files")
        .option("--ids <ids>", "comma-separated list of task IDs to process")
        .parse();

    const opts = program.opts<{ dryRun: boolean; ids?: string }>();
    const dryRun = opts.dryRun;
    const filterIds = opts.ids ? opts.ids.split(",") : null;

    const taskDirs = fs.readdirSync(TASKS_DIR)
        .filter(d => /^MW-\d+$/.test(d))
        .sort();

    const targets = filterIds
        ? taskDirs.filter(d => filterIds.includes(d))
        : taskDirs;

    console.log(`Processing ${targets.length} tasks${dryRun ? " (dry-run)" : ""}...\n`);

    const results: TaskResult[] = targets.map(taskId => processTask(taskId, dryRun));

    const successResults = results.filter((r): r is TaskSuccess => r.status === "success");
    const successes = successResults.length;
    const failures  = results.filter(r => r.status === "failure").length;
    console.log(`\nDone: ${successes} generated, ${failures} failed.`);

    if (!dryRun) {
        const now = new Date();
        const catalogVersion = `${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}-${Math.floor(Date.now() / 1000)}` as IEverMarketplaceVersion;
        const catalog: IEverMarketplaceCatalog = {
            catalogVersion,
            items: successResults.map(r => r.item),
            categories: EVER_MARKETPLACE_CATEGORY_NAMES,
        };
        fs.writeFileSync(path.join(CATALOG_DIR, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
        console.log(`Catalog: ${path.join(CATALOG_DIR, "catalog.json")} (${successes} items, version ${catalogVersion})`);
    }

    const date = new Date().toISOString().slice(0, 10);
    const reportPath = path.join(REPORTS_DIR, `catalog-build-report-${date}.html`);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(reportPath, generateHtml(results, date, dryRun), "utf-8");
    console.log(`Report: ${reportPath}`);
}

main();
