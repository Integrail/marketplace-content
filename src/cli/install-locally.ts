#!/usr/bin/env node
/**
 * Installs the most recent marketplace ZIP into a local MongoDB instance.
 *
 * Usage:
 *   npm run marketplace-install-locally
 *
 * Collection: marketplace_v1
 * Indexes:    text search (name + description), categories, tags, type, id (unique)
 *
 * Environment variables:
 *   MONGODB_URI         Full connection string — overrides all other options
 *   MONGODB_HOST        Host (default: localhost)
 *   MONGODB_PORT        Port (default: 27017)
 *   MONGODB_USERNAME    Username (default: integrail)
 *   MONGODB_PASSWORD    Password (default: password)
 *   MONGODB_DB          Database name (default: everworker)
 *   MONGODB_COLLECTION  Collection name (default: marketplace_v1)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(ROOT, 'marketplace-dist');

const MONGODB_HOST = process.env.MONGODB_HOST ?? 'localhost';
const MONGODB_PORT = process.env.MONGODB_PORT ?? '27017';
const MONGODB_USERNAME = process.env.MONGODB_USERNAME ?? 'integrail';
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD ?? 'password';
const MONGODB_URI =
    process.env.MONGODB_URI ??
    `mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}`;
const MONGODB_DB = process.env.MONGODB_DB ?? 'everworker';
const COLLECTION = process.env.MONGODB_COLLECTION ?? 'marketplace_v1';

interface Manifest {
    version: string;
    generatedAt: string;
    mode: string;
    s3BaseUrl: string;
    items: Array<{ id: string; file: string; name: string }>;
}

function findLatestZip(): string | null {
    if (!fs.existsSync(DIST_DIR)) return null;
    const zips = fs
        .readdirSync(DIST_DIR)
        .filter((f) => f.endsWith('.zip') && f.startsWith('everworker-marketplace-'))
        .map((f) => ({ name: f, mtime: fs.statSync(path.join(DIST_DIR, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return zips.length > 0 ? path.join(DIST_DIR, zips[0].name) : null;
}

async function main() {
    const zipPath = findLatestZip();
    if (!zipPath) {
        console.error(`No marketplace ZIP found in ${DIST_DIR}`);
        console.error('Run "npm run marketplace-package" first.');
        process.exit(1);
    }

    console.log(`Installing from: ${path.basename(zipPath)}`);
    console.log(`  MongoDB: ${MONGODB_URI} → ${MONGODB_DB}.${COLLECTION}\n`);

    const zipBuffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    const manifestFile = zip.file('index.json');
    if (!manifestFile) { console.error('ZIP missing index.json'); process.exit(1); }

    const manifest: Manifest = JSON.parse(await manifestFile.async('string'));
    console.log(`  Catalog version: ${manifest.version}  mode: ${manifest.mode}  items: ${manifest.items.length}`);

    // Load all item documents from the ZIP
    const items: Record<string, unknown>[] = [];
    for (const entry of manifest.items) {
        const file = zip.file(entry.file);
        if (!file) { console.warn(`  [skip] Missing in ZIP: ${entry.file}`); continue; }
        const item = JSON.parse(await file.async('string')) as Record<string, unknown>;
        items.push({
            ...item,
            _catalogVersion: manifest.version,
            _installedAt: new Date(),
        });
    }

    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const col = client.db(MONGODB_DB).collection(COLLECTION);

        let upserted = 0;
        for (const item of items) {
            await col.replaceOne({ id: item['id'] }, item, { upsert: true });
            upserted++;
        }

        // Ensure indexes (idempotent)
        await col.createIndex({ name: 'text', description: 'text' }, { name: 'text_search' });
        await col.createIndex({ categories: 1 }, { name: 'categories_idx' });
        await col.createIndex({ tags: 1 }, { name: 'tags_idx' });
        await col.createIndex({ type: 1 }, { name: 'type_idx' });
        await col.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });

        console.log(`\nDone: ${upserted} items upserted into ${MONGODB_DB}.${COLLECTION}`);
        console.log('  Indexes: text_search, categories_idx, tags_idx, type_idx, id_unique');
    } finally {
        await client.close();
    }
}

main().catch((err) => { console.error(err); process.exit(1); });
