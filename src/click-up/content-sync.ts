#!/usr/bin/env node
/**
 * release:fetch — Syncs ClickUp list tasks to the local marketplace-build directory.
 *
 * Uses hardcoded configuration from src/config.ts.
 * Reads the ClickUp access token from .click-up/settings.json (git-ignored).
 * Stores sync state in marketplace-build/click-up-sync.json.
 *
 * Usage:
 *   npx tsx src/click-up/content-sync.ts
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
    getTasksInList,
    getTaskDetail,
    getTaskActivity,
    downloadAttachment,
    type ClickUpTask,
} from './clickup-api.js';
import { readSettings, getSettingsPath } from './settings.js';
import {
    CLICKUP_LIST_ID,
    CLICKUP_LIST_URL,
    CLICKUP_SYNC_TARGET,
    CLICKUP_SYNC_STATE_PATH,
} from '../config.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncState {
    lastSync: string;
    listLastSync: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const workDir = process.cwd();
    const statePath = path.join(workDir, CLICKUP_SYNC_STATE_PATH);

    console.log('ClickUp Content Sync');
    console.log('');

    // ── Load sync state (broken/missing → full fetch) ─────────────────────────
    const state: SyncState = (await readJsonFile<SyncState>(statePath)) ?? { lastSync: '', listLastSync: {} };

    // ── Check token ───────────────────────────────────────────────────────────
    const settings = await readSettings();
    if (!settings?.clickUp?.token) {
        console.error(`✗ ClickUp token not configured. Run "npm run setup" first.`);
        console.error(`  Settings file: ${getSettingsPath()}`);
        process.exit(1);
    }
    const token = settings.clickUp.token;

    // ── Sync list ─────────────────────────────────────────────────────────────
    const listId = CLICKUP_LIST_ID;
    const sourceUrl = CLICKUP_LIST_URL;
    const targetPath = path.resolve(workDir, CLICKUP_SYNC_TARGET);
    const tasksPath = path.join(targetPath, 'tasks');

    console.log(`→ Syncing: ${sourceUrl}`);
    console.log(`  Target: ${targetPath}`);
    console.log(`  List ID: ${listId}`);

    await ensureDir(tasksPath);

    const listLastSync = state.listLastSync[sourceUrl];
    const isIncremental = !!listLastSync;
    console.log(isIncremental
        ? `→ Fetching tasks updated since ${listLastSync}...`
        : '→ Fetching all tasks from ClickUp...');

    let tasks: ClickUpTask[];
    try {
        tasks = await getTasksInList(listId, token, listLastSync);
    } catch (err: unknown) {
        console.error(`  ✗ Failed to fetch tasks: ${(err as Error).message}`);
        process.exit(1);
    }

    console.log(`✓ Found ${tasks.length} task(s) to process`);
    console.log('');

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const task of tasks) {
        const taskKey = task.custom_id || task.id;
        const taskDir = path.join(tasksPath, taskKey);
        const attachmentsDir = path.join(taskDir, 'attachments');

        try {
            await ensureDir(taskDir);

            // Skip if already up to date
            const summaryPath = path.join(taskDir, `${taskKey}-summary.json`);
            if (task.date_updated) {
                const existing = await readJsonFile<ClickUpTask>(summaryPath);
                if (existing?.date_updated === task.date_updated) {
                    skipped++;
                    continue;
                }
            }

            // Full task detail
            const detail = await getTaskDetail(task.id, token);
            await writeJsonFile(summaryPath, detail);

            // Activity (comments)
            const activity = await getTaskActivity(task.id, token);
            await writeJsonFile(path.join(taskDir, `${taskKey}-activity.json`), activity);

            // Attachments — skip files that already exist locally
            const attachments = detail.attachments ?? [];
            if (attachments.length > 0) {
                await ensureDir(attachmentsDir);
                for (const att of attachments) {
                    const attPath = path.join(attachmentsDir, att.title);
                    if (existsSync(attPath)) continue;
                    try {
                        const data = await downloadAttachment(att.url, token);
                        await fs.writeFile(attPath, data);
                    } catch (attErr: unknown) {
                        console.warn(`    ⚠ Attachment "${att.title}" skipped: ${(attErr as Error).message}`);
                    }
                }
            }

            processed++;
            if (processed % 10 === 0 || processed === tasks.length) {
                console.log(`  ℹ ${processed}/${tasks.length} tasks processed...`);
            }

            await sleep(80);

        } catch (err: unknown) {
            console.warn(`  ⚠ Error on task ${taskKey}: ${(err as Error).message}`);
            errors++;
        }
    }

    // Write index.json
    await writeJsonFile(path.join(targetPath, 'index.json'), {
        syncedAt: new Date().toISOString(),
        listId,
        sourceUrl,
        totalTasks: tasks.length,
        processed,
        skipped,
        errors,
    });

    state.listLastSync[sourceUrl] = new Date().toISOString();
    state.lastSync = new Date().toISOString();

    await ensureDir(path.dirname(statePath));
    await writeJsonFile(statePath, state);

    console.log('');
    console.log(`✓ List sync done — ${processed} updated, ${skipped} unchanged, ${errors} error(s)`);
    console.log(`  Output: ${targetPath}`);
    console.log('');
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
