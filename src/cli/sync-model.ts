#!/usr/bin/env node
/**
 * Copies *.ts model files (excluding *.test.ts) from ./src/model to
 * everworker/imports/core/integrations/marketplace.
 *
 * Usage:
 *   npx tsx src/cli/sync-model.ts
 *   npx tsx src/cli/sync-model.ts ../path/to/everworker
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const everworkerArg = process.argv[2];
const EVERWORKER_ROOT = path.resolve(ROOT, everworkerArg ?? '../everworker');
const SRC_DIR = path.join(ROOT, 'src/model');
const DEST_DIR = path.join(EVERWORKER_ROOT, 'imports/core/integrations/marketplace/model');

if (!fs.existsSync(EVERWORKER_ROOT)) {
    console.error(`Everworker repository not found: ${EVERWORKER_ROOT}`);
    console.error('Pass the path as the first argument, e.g.:');
    console.error('  npx tsx src/cli/sync-model.ts ../everworker');
    process.exit(1);
}

if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });

const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

if (files.length === 0) {
    console.log('No .ts model files found to copy.');
    process.exit(0);
}

console.log(`Syncing ${files.length} file(s) to ${DEST_DIR}\n`);

for (const file of files) {
    const src = path.join(SRC_DIR, file);
    const dest = path.join(DEST_DIR, file);
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
}

console.log('\nDone.');
