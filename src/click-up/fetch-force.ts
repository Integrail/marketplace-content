#!/usr/bin/env node
/**
 * release:fetch-force — Clears all ClickUp sync caches and resets lastSync so
 * the subsequent release:fetch performs a full re-fetch of all tasks.
 *
 * What it does:
 *   1. Removes all cached task data under marketplace-build/click-up/tasks/.
 *   2. Resets lastSync in marketplace-build/click-up-sync.json.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CLICKUP_SYNC_TARGET, CLICKUP_SYNC_STATE_PATH } from '../config.js';

async function main(): Promise<void> {
    const workDir = process.cwd();
    const tasksDir = path.resolve(workDir, CLICKUP_SYNC_TARGET, 'tasks');
    const statePath = path.join(workDir, CLICKUP_SYNC_STATE_PATH);

    // 1. Clear cached tasks
    if (existsSync(tasksDir)) {
        await fs.rm(tasksDir, { recursive: true, force: true });
        console.log(`✓ Cleared cache: ${tasksDir}`);
    }

    // 2. Reset sync state
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify({ lastSync: '', listLastSync: {} }, null, 2) + '\n', 'utf-8');
    console.log(`✓ Reset sync state: ${statePath}`);
    console.log('');
    console.log('Ready for full re-fetch. Run: npm run release:fetch');
}

main().catch(err => { console.error(err); process.exit(1); });
