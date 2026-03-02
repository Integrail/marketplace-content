#!/usr/bin/env node
/**
 * Builds catalog/MW-XXXX/index.json (and any markdown attachments) for every
 * ClickUp task summary found under click-up/tasks/MW-XXXX/.
 *
 * Usage:
 *   npx tsx src/cli/build-catalog.ts
 *   npx tsx src/cli/build-catalog.ts --dry-run
 *   npx tsx src/cli/build-catalog.ts --ids=MW-1001,MW-1005
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogItem } from "../lib/catalog-build.js";
import type { CatalogItemResult } from "../lib/catalog-build.js";
import type { ClickUpTaskSummary } from "../lib/clickup-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TASKS_DIR = path.join(ROOT, "click-up/tasks");
const CATALOG_DIR = path.join(ROOT, "catalog");

const DRY_RUN = process.argv.includes("--dry-run");
const IDS_ARG = process.argv.find(a => a.startsWith("--ids="));
const FILTER_IDS = IDS_ARG ? IDS_ARG.replace("--ids=", "").split(",") : null;

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts an ew-marketplace:// attachment href to an output file path.
 * e.g. "ew-marketplace://MW-1001/card-description.md" → "<CATALOG_DIR>/MW-1001/card-description.md"
 */
function hrefToFilePath(href: string): string {
    const withoutScheme = href.replace(/^ew-marketplace:\/\//, "");
    return path.join(CATALOG_DIR, withoutScheme);
}

// ── main ──────────────────────────────────────────────────────────────────────

function processTask(taskId: string): boolean {
    const summaryPath = path.join(TASKS_DIR, taskId, `${taskId}-summary.json`);

    if (!fs.existsSync(summaryPath)) {
        console.warn(`  [skip] No summary JSON for ${taskId}`);
        return false;
    }

    let summary: ClickUpTaskSummary;
    try {
        summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as ClickUpTaskSummary;
    } catch (err) {
        console.error(`  [error] Failed to parse ${summaryPath}: ${err}`);
        return false;
    }

    let result: CatalogItemResult;
    try {
        result = buildCatalogItem(summary);
    } catch (err) {
        console.error(`  [error] buildCatalogItem failed for ${taskId}: ${err}`);
        return false;
    }

    const outDir = path.join(CATALOG_DIR, taskId);
    const indexPath = path.join(outDir, "index.json");

    if (DRY_RUN) {
        console.log(`  [dry-run] Would write: ${indexPath}`);
        for (const href of Object.keys(result.attachments)) {
            console.log(`  [dry-run] Would write: ${hrefToFilePath(href)}`);
        }
        console.log(JSON.stringify(result.item, null, 2).slice(0, 500) + "...");
    } else {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(indexPath, JSON.stringify(result.item, null, 2) + "\n");
        for (const [href, content] of Object.entries(result.attachments)) {
            const filePath = hrefToFilePath(href);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content);
        }
        console.log(`  ✓ ${taskId}: ${summary.name}`);
    }

    return true;
}

function main(): void {
    const taskDirs = fs.readdirSync(TASKS_DIR)
        .filter(d => /^MW-\d+$/.test(d))
        .sort();

    const targets = FILTER_IDS
        ? taskDirs.filter(d => FILTER_IDS.includes(d))
        : taskDirs;

    console.log(`Processing ${targets.length} tasks${DRY_RUN ? " (dry-run)" : ""}...\n`);

    let success = 0;
    let skipped = 0;
    for (const taskId of targets) {
        if (processTask(taskId)) success++; else skipped++;
    }

    console.log(`\nDone: ${success} generated, ${skipped} skipped.`);
}

main();
