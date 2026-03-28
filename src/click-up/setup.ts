#!/usr/bin/env node
/**
 * setup — Ensures .click-up/settings.json exists with a valid ClickUp token.
 *
 * Usage:
 *   npm run setup
 *   npx tsx src/click-up/setup.ts
 */

import * as readline from 'node:readline';
import { readSettings, writeSettings, getSettingsPath } from './settings.js';
import { validateToken } from './clickup-api.js';

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}

async function main(): Promise<void> {
    console.log('Marketplace Content — Setup');
    console.log('');

    const settingsPath = getSettingsPath();
    console.log(`Settings file: ${settingsPath}`);
    console.log('');

    const existing = await readSettings();
    const existingToken = existing?.clickUp?.token ?? '';

    if (existingToken) {
        console.log('→ Validating existing ClickUp token...');
        const valid = await validateToken(existingToken);
        if (valid) {
            console.log('✓ ClickUp token is valid. Setup complete.');
            return;
        }
        console.log('✗ ClickUp token is invalid or expired.');
        console.log('');
    } else {
        console.log('No ClickUp token found.');
        console.log('');
    }

    console.log('To get your ClickUp API token:');
    console.log('  1. Go to ClickUp → Settings → Apps');
    console.log('  2. Click "Generate" under "API Token"');
    console.log('  3. Copy the token');
    console.log('');

    let token = '';
    while (!token) {
        token = await prompt('Enter your ClickUp API token: ');
        if (!token) {
            console.log('Token cannot be empty. Please try again.');
        }
    }

    console.log('');
    console.log('→ Validating token...');
    const valid = await validateToken(token);
    if (!valid) {
        console.error('✗ Token validation failed. Please check the token and try again.');
        process.exit(1);
    }

    await writeSettings({ clickUp: { token } });
    console.log(`✓ Token saved to ${settingsPath}`);
    console.log('✓ Setup complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
