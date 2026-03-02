#!/usr/bin/env node
/**
 * Generates catalog/MW-XXXX/index.json (and how-it-works.md) for every ClickUp task
 * that has an extracted PDF attachment (.MD file).
 *
 * Usage:
 *   npx tsx src/cli/generate-catalog.ts
 *   npx tsx src/cli/generate-catalog.ts --dry-run
 *   npx tsx src/cli/generate-catalog.ts --ids MW-1001,MW-1005
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMDFile, buildCatalogItem, type SummaryJson } from '../lib/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TASKS_DIR = path.join(ROOT, 'click-up/tasks');
const CATALOG_DIR = path.join(ROOT, 'catalog');

const DRY_RUN = process.argv.includes('--dry-run');
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='));
const FILTER_IDS = IDS_ARG ? IDS_ARG.replace('--ids=', '').split(',') : null;

// ── main ──────────────────────────────────────────────────────────────────────

function processTask(taskId: string): boolean {
    const taskDir = path.join(TASKS_DIR, taskId);
    const summaryPath = path.join(taskDir, `${taskId}-summary.json`);
    const attachmentsDir = path.join(taskDir, 'attachments');

    if (!fs.existsSync(summaryPath)) {
        console.warn(`  [skip] No summary.json for ${taskId}`);
        return false;
    }

    const summary: SummaryJson = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    // Find the .MD file
    let mdPath: string | null = null;
    if (fs.existsSync(attachmentsDir)) {
        const mdFiles = fs.readdirSync(attachmentsDir).filter(f => f.endsWith('.MD'));
        if (mdFiles.length > 0) {
            mdPath = path.join(attachmentsDir, mdFiles[0]);
        }
    }

    if (!mdPath) {
        console.warn(`  [skip] No .MD attachment for ${taskId}`);
        return false;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const parsed = parseMDFile(mdContent);

    const { item, attachments } = buildCatalogItem(taskId, summary, parsed);

    const outDir = path.join(CATALOG_DIR, taskId);
    const indexPath = path.join(outDir, 'index.json');

    if (DRY_RUN) {
        console.log(`  [dry-run] Would write: ${indexPath}`);
        for (const fileName of Object.keys(attachments)) {
            console.log(`  [dry-run] Would write: ${path.join(outDir, fileName)}`);
        }
        console.log(JSON.stringify(item, null, 2).slice(0, 500) + '...');
    } else {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(indexPath, JSON.stringify(item, null, 2) + '\n');
        for (const [fileName, content] of Object.entries(attachments)) {
            fs.writeFileSync(path.join(outDir, fileName), content);
        }
        console.log(`  ✓ ${taskId}: ${summary.name}`);
    }

    return true;
}

function main() {
    const taskDirs = fs.readdirSync(TASKS_DIR)
        .filter(d => /^MW-\d+$/.test(d))
        .sort();

    const targets = FILTER_IDS
        ? taskDirs.filter(d => FILTER_IDS.includes(d))
        : taskDirs;

    console.log(`Processing ${targets.length} tasks${DRY_RUN ? ' (dry-run)' : ''}...\n`);

    let success = 0;
    let skipped = 0;
    for (const taskId of targets) {
        const ok = processTask(taskId);
        if (ok) success++; else skipped++;
    }

    console.log(`\nDone: ${success} generated, ${skipped} skipped.`);
}

main();
