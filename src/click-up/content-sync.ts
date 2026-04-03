#!/usr/bin/env node
/**
 * release:fetch — Syncs ClickUp list tasks to the local marketplace-build directory.
 *
 * Reads sync configuration from everhow-clickup-sync.json in the working directory.
 * Reads the ClickUp access token from .click-up/settings.json (git-ignored).
 *
 * Usage:
 *   npx tsx src/click-up/content-sync.ts
 */

import * as readline from 'node:readline';
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

// ── Config ────────────────────────────────────────────────────────────────────

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

interface SyncState {
    lastSync: string;
    listLastSync: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}

function extractListId(url: string): string {
    const match = url.match(/\/v\/li\/\d+-(\d+)/);
    if (match) return match[1];
    const direct = url.match(/\/v\/li\/(\d+)/);
    if (direct) return direct[1];
    throw new Error(`Cannot extract list ID from ClickUp URL: ${url}`);
}

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
    const configPath = path.join(workDir, SYNC_CONFIG_FILE);
    const statePath = path.join(workDir, STATE_FILE);

    console.log('ClickUp Content Sync');
    console.log('');

    // ── Load or create config ─────────────────────────────────────────────────
    let config = await readJsonFile<ClickUpSyncConfig>(configPath);

    if (!config) {
        console.log(`No ${SYNC_CONFIG_FILE} found in ${workDir}`);
        const create = await prompt('Create a new sync configuration? (yes/no): ');
        if (create.toLowerCase() !== 'yes' && create.toLowerCase() !== 'y') {
            console.log('Sync cancelled.');
            return;
        }

        console.log('');
        const sourceUrl = await prompt('Enter ClickUp list URL (e.g. https://app.clickup.com/.../v/li/...): ');
        if (!sourceUrl) { console.error('Source URL is required'); process.exit(1); }

        const targetDir = await prompt('Enter local target directory (relative to working dir): ');
        if (!targetDir) { console.error('Target directory is required'); process.exit(1); }

        config = { command: 'click-up-list-sync', listsToSync: [{ source: sourceUrl, target: targetDir }] };
        await writeJsonFile(configPath, config);
        console.log(`✓ Created ${SYNC_CONFIG_FILE}`);
        console.log('');
    }

    // ── Load sync state ───────────────────────────────────────────────────────
    const state: SyncState = (await readJsonFile<SyncState>(statePath)) ?? { lastSync: '', listLastSync: {} };

    // ── Check token ───────────────────────────────────────────────────────────
    const settings = await readSettings();
    if (!settings?.clickUp?.token) {
        console.error(`✗ ClickUp token not configured. Run "npm run setup" first.`);
        console.error(`  Settings file: ${getSettingsPath()}`);
        process.exit(1);
    }
    const token = settings.clickUp.token;

    // ── Sync each list ────────────────────────────────────────────────────────
    for (const entry of config.listsToSync) {
        console.log(`→ Syncing: ${entry.source}`);
        console.log(`  Target: ${entry.target}`);

        let listId: string;
        try {
            listId = extractListId(entry.source);
        } catch (err: unknown) {
            console.error(`  ✗ ${(err as Error).message}`);
            continue;
        }

        console.log(`  List ID: ${listId}`);

        const targetPath = path.resolve(workDir, entry.target);
        const tasksPath = path.join(targetPath, 'tasks');
        await ensureDir(tasksPath);

        const listLastSync = state.listLastSync[entry.source];
        const isIncremental = !!listLastSync;
        console.log(isIncremental
            ? `→ Fetching tasks updated since ${listLastSync}...`
            : '→ Fetching all tasks from ClickUp...');

        let tasks: ClickUpTask[];
        try {
            tasks = await getTasksInList(listId, token, listLastSync);
        } catch (err: unknown) {
            console.error(`  ✗ Failed to fetch tasks: ${(err as Error).message}`);
            continue;
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

                console.log(`  ℹ ${taskKey} processed`);

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
            sourceUrl: entry.source,
            totalTasks: tasks.length,
            processed,
            skipped,
            errors,
        });

        state.listLastSync[entry.source] = new Date().toISOString();

        console.log('');
        console.log(`✓ List sync done — ${processed} updated, ${skipped} unchanged, ${errors} error(s)`);
        console.log(`  Output: ${targetPath}`);
    }

    state.lastSync = new Date().toISOString();
    await writeJsonFile(statePath, state);

    console.log('');
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
