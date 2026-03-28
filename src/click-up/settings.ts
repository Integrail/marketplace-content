/**
 * Settings management for the local ClickUp sync configuration.
 * Settings are stored in ./.click-up/settings.json (git-ignored).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface ClickUpLocalSettings {
    clickUp: {
        token: string;
    };
}

export function getSettingsPath(): string {
    return path.join(process.cwd(), '.click-up', 'settings.json');
}

export async function readSettings(): Promise<ClickUpLocalSettings | null> {
    try {
        const content = await fs.readFile(getSettingsPath(), 'utf-8');
        return JSON.parse(content) as ClickUpLocalSettings;
    } catch {
        return null;
    }
}

export async function writeSettings(settings: ClickUpLocalSettings): Promise<void> {
    const settingsPath = getSettingsPath();
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
