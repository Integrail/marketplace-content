#!/usr/bin/env node
/**
 * release:build — Builds the marketplace catalog from synced ClickUp tasks.
 *
 * Reads from:  marketplace-build/click-up/tasks/
 * Writes to:   marketplace-build/catalog/   (cleaned before each run)
 *
 * Usage:
 *   npx tsx src/cli/build-catalog.ts
 *   npx tsx src/cli/build-catalog.ts --dry-run
 *   npx tsx src/cli/build-catalog.ts --ids MW-1007,MW-1101
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { buildCatalogItem } from "../lib/catalog-build.js";
import type { CatalogItemResult } from "../lib/catalog-build.js";
import * as clickup from "../lib/clickup-utils.js";
import type { ClickUpTaskSummary } from "../lib/clickup-utils.js";
import { assertCatalogItemResult, ValidationError, ValidationWarning } from "../lib/catalog-validate.js";
import { EVER_MARKETPLACE_CATEGORY_NAMES, type IEverMarketplaceCatalog, type IEverMarketplaceCatalogItem, type IEverMarketplaceVersion } from "../model/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TASKS_DIR = path.join(ROOT, "marketplace-build/click-up/tasks");
const CATALOG_DIR = path.join(ROOT, "marketplace-build/catalog");
const REPORTS_DIR = path.join(ROOT, "reports");

// ── types ─────────────────────────────────────────────────────────────────────

type TaskSuccess = { status: "success"; id: string; name: string; warnings: ValidationWarning[]; item: IEverMarketplaceCatalogItem };
type TaskSkip    = { status: "skip";    id: string; reason: string };
type TaskFailure = { status: "failure"; id: string; reason: string; critical: boolean; issues?: ValidationError[] };
type TaskResult  = TaskSuccess | TaskSkip | TaskFailure;

// ── task processing ───────────────────────────────────────────────────────────

async function processTask(taskId: string, dryRun: boolean): Promise<TaskResult> {
    const summaryPath = path.join(TASKS_DIR, taskId, `${taskId}-summary.json`);

    if (!fs.existsSync(summaryPath)) {
        return { status: "skip", id: taskId, reason: "No summary JSON found" };
    }

    let summary: ClickUpTaskSummary;
    try {
        summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as ClickUpTaskSummary;
    } catch (err) {
        return { status: "failure", id: taskId, reason: `Failed to parse summary JSON: ${err}`, critical: true };
    }

    // Skip items with no ITEM_PUBLISHING_VISIBILITY
    const visibilityField = clickup.getField(summary, "ITEM_PUBLISHING_VISIBILITY");
    const visibility = visibilityField ? clickup.getDropDownValue(visibilityField) : undefined;
    if (!visibility) {
        return { status: "skip", id: taskId, reason: "ITEM_PUBLISHING_VISIBILITY not set" };
    }

    const attachmentsDir = path.join(TASKS_DIR, taskId, "attachments");
    const localAttachments: Record<string, Buffer> = {};
    if (fs.existsSync(attachmentsDir)) {
        for (const filename of fs.readdirSync(attachmentsDir)) {
            localAttachments[filename] = fs.readFileSync(path.join(attachmentsDir, filename));
        }
    }

    let result: CatalogItemResult;
    let warnings: ValidationWarning[] = [];
    try {
        result = await buildCatalogItem(summary, { localAttachments, attachmentsDir });
    } catch (err) {
        console.error(`  [error] buildCatalogItem failed for ${taskId}: ${err}`);
        return { status: "failure", id: taskId, reason: `Build failed: ${err}`, critical: true };
    }

    const validationResult = assertCatalogItemResult(result);
    warnings = validationResult.warnings;
    if (validationResult.errors.length > 0) {
        return { status: "failure", id: taskId, reason: "Validation errors", critical: false, issues: validationResult.errors };
    }

    const outDir = path.join(CATALOG_DIR, taskId);
    const indexPath = path.join(outDir, "index.json");

    if (dryRun) {
        console.log(`  [dry-run] Would write: ${indexPath}`);
        for (const filename of Object.keys(result.attachments)) {
            console.log(`  [dry-run] Would write: ${path.join(outDir, filename)}`);
        }
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
    const successes   = results.filter((r): r is TaskSuccess => r.status === "success");
    const skips       = results.filter((r): r is TaskSkip    => r.status === "skip");
    const failures    = results.filter((r): r is TaskFailure => r.status === "failure");
    const withWarnings = successes.filter(r => r.warnings.length > 0);
    const totalWarnings = successes.reduce((n, r) => n + r.warnings.length, 0);

    const successRows = successes.map(r => {
        const badge = r.warnings.length > 0
            ? ` <span class="warn-badge">${r.warnings.length}</span>`
            : "";
        return `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}${badge}</td></tr>`;
    }).join("\n");

    const skipRows = skips.map(r =>
        `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.reason)}</td></tr>`,
    ).join("\n");

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
    .stat-skip    { background: #e2e3e5; color: #383d41; }
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
    <span class="stat stat-success">Built: ${successes.length}</span>
    <span class="stat stat-skip">Skipped: ${skips.length}</span>
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

  <h2>Skipped (${skips.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Reason</th></tr></thead>
    <tbody>${skipRows || "<tr><td colspan=\"2\">None</td></tr>"}</tbody>
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

async function main(): Promise<void> {
    program
        .option("--dry-run", "preview changes without writing files")
        .option("--ids <ids>", "comma-separated list of task IDs to process")
        .parse();

    const opts = program.opts<{ dryRun: boolean; ids?: string }>();
    const dryRun = opts.dryRun;
    const filterIds = opts.ids ? opts.ids.split(",") : null;

    if (!fs.existsSync(TASKS_DIR)) {
        console.error(`Error: ${TASKS_DIR} not found. Run "npm run release:fetch" first.`);
        process.exit(1);
    }

    const taskDirs = fs.readdirSync(TASKS_DIR)
        .filter(d => /^MW-\d+$/.test(d))
        .sort();

    const targets = filterIds
        ? taskDirs.filter(d => filterIds.includes(d))
        : taskDirs;

    // Clean output directory before each full build (not when filtering by IDs)
    if (!dryRun && !filterIds) {
        fs.rmSync(CATALOG_DIR, { recursive: true, force: true });
        console.log(`Cleaned ${CATALOG_DIR}`);
    }

    console.log(`Processing ${targets.length} tasks${dryRun ? " (dry-run)" : ""}...\n`);

    const results: TaskResult[] = await Promise.all(targets.map(taskId => processTask(taskId, dryRun)));

    const successResults = results.filter((r): r is TaskSuccess => r.status === "success");
    const failures       = results.filter((r): r is TaskFailure => r.status === "failure");
    const skips          = results.filter((r): r is TaskSkip    => r.status === "skip");

    // Extract unique app names from all items for an app filter
    const appOptionsList = Array.from(new Set(
        successResults.flatMap(r =>
            [...r.item.primaryApps, ...r.item.apps].map(app => app.name)
        )
    )).sort()

    // Print validation issues in the requested format
    const withIssues = failures.filter((f): f is TaskFailure & { issues: ValidationError[] } => !!f.issues?.length);
    if (withIssues.length > 0) {
        console.log('\nIssues in marketplace definition in Click-Up');
        for (const f of withIssues) {
            console.log(`\n${f.id}`);
            for (const issue of f.issues) {
                console.log(`- ${issue.field}: ${issue.message}`);
            }
        }
    }

    console.log(`\nDone: ${successResults.length} built, ${skips.length} skipped, ${failures.length} failed.`);

    if (!dryRun) {
        const now = new Date();
        const catalogVersion = `${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}-${Math.floor(Date.now() / 1000)}` as IEverMarketplaceVersion;
    
        const catalog: IEverMarketplaceCatalog = {
            catalogVersion,
            items: successResults.map(r => r.item),
            categories: EVER_MARKETPLACE_CATEGORY_NAMES,
            apps: appOptionsList,
        };
        fs.mkdirSync(CATALOG_DIR, { recursive: true });
        fs.writeFileSync(path.join(CATALOG_DIR, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
        console.log(`Catalog: ${path.join(CATALOG_DIR, "catalog.json")} (${successResults.length} items, version ${catalogVersion})`);
    }

    // Write HTML report
    const date = new Date().toISOString().slice(0, 10);
    const reportPath = path.join(REPORTS_DIR, `catalog-build-report-${date}.html`);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(reportPath, generateHtml(results, date, dryRun), "utf-8");
    console.log(`Report: ${reportPath}`);

    // Halt on critical errors
    if (failures.length > 0) {
        console.error(`\n[CRITICAL] ${failures.length} item(s) failed to build. Fix the errors above and re-run.`);
        process.exit(1);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
