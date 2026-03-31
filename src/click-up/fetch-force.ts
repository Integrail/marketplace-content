#!/usr/bin/env node
/**
 * release:fetch-force — Clears all ClickUp sync caches and resets lastSync so
 * the next release:fetch performs a full re-fetch of all tasks.
 *
 * What it does:
 *   1. Removes all cached task data under the sync target's tasks/ directory.
 *   2. Resets lastSync (top-level and per-list) in everhow-clickup-sync.json.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SYNC_CONFIG_FILE = 'everhow-clickup-sync.json';
const STATE_FILE = '.everhow-clickup-sync-state.json';

interface ListSyncEntry {
    source: string;
    target: string;
}

interface ClickUpSyncConfig {
    command: string;
    listsToSync: ListSyncEntry[];
}

async function main(): Promise<void> {
    const workDir = process.cwd();
    const buildDir = path.join(workDir, "marketplace-build");
    const configPath = path.join(buildDir, SYNC_CONFIG_FILE);
    const statePath = path.join(buildDir, STATE_FILE);

    const raw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw) as ClickUpSyncConfig;

    // 1. Clear cached tasks for each list
    for (const entry of config.listsToSync) {
        const tasksDir = path.resolve(workDir, entry.target, 'tasks');
        if (existsSync(tasksDir)) {
            await fs.rm(tasksDir, { recursive: true, force: true });
            console.log(`✓ Cleared cache: ${tasksDir}`);
        }
    }

    // 2. Reset sync state
    await fs.writeFile(statePath, JSON.stringify({ lastSync: '', listLastSync: {} }, null, 2) + '\n', 'utf-8');
    console.log(`✓ Reset lastSync in ${STATE_FILE}`);
    console.log('');
    console.log('Ready for full re-fetch. Run: npm run release:fetch');
}

main().catch(err => { console.error(err); process.exit(1); });
