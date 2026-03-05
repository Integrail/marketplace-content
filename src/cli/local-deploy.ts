#!/usr/bin/env node
/**
 * Downloads a published catalog from the media store and deploys it to MongoDB.
 *
 * Usage:
 *   npx tsx src/cli/local-deploy.ts --environment dev-0
 *   npx tsx src/cli/local-deploy.ts --environment qa --mongo-connection-string mongodb://localhost:27017/mydb
 */

import "dotenv/config";
import { Option, program } from "commander";
import JSZip from "jszip";
import { MongoClient } from "mongodb";
import type { IEverMarketplaceCatalog } from "../model/catalog.js";
import { parseNonEmptyString } from "../lib/cli.js";
import { MEDIA_STORE_URL } from "../lib/media-store.js";

async function main(): Promise<void> {
    program
        .requiredOption(
            "--environment <name>",
            "target environment (e.g. dev-0, qa, prod)",
            parseNonEmptyString,
        )
        .addOption(
            new Option(
                "--media-store-url <url>",
                "base URL of the media store (overrides MEDIA_STORE_URL from env)",
            )
            .env("MEDIA_STORE_URL")
            .argParser(parseNonEmptyString)
            .default(MEDIA_STORE_URL),
        )
        .addOption(
            new Option(
                "--mongo-connection-string <uri>",
                "MongoDB connection string"
            )
            .makeOptionMandatory(true)
            .env("MONGO_URL")
            .argParser(parseNonEmptyString),
        )
        .parse();

    const opts = program.opts<{
        environment: string;
        mediaStoreUrl: string;
        mongoConnectionString: string;
    }>();

    const { environment, mediaStoreUrl, mongoConnectionString } = opts;

    // ── Download catalog.zip ─────────────────────────────────────────────────

    const base = mediaStoreUrl.replace(/\/+$/, "");
    const zipUrl = `${base}/${environment}/catalog.zip`;
    console.log(`Downloading ${zipUrl} ...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
        console.error(`Error: Failed to download catalog.zip — HTTP ${response.status} ${response.statusText}`);
        process.exit(1);
    }
    const zipBuffer = Buffer.from(await response.arrayBuffer());

    // ── Extract catalog.json ─────────────────────────────────────────────────

    const zip = await JSZip.loadAsync(zipBuffer);
    const catalogFile = zip.file("catalog.json");
    if (!catalogFile) {
        console.error("Error: catalog.json not found inside catalog.zip");
        process.exit(1);
    }
    const catalogJson = await catalogFile.async("string");
    const catalog = JSON.parse(catalogJson) as IEverMarketplaceCatalog;
    console.log(`Loaded catalog version ${catalog.catalogVersion} with ${catalog.items.length} items`);

    // ── MongoDB deploy ───────────────────────────────────────────────────────

    const client = new MongoClient(mongoConnectionString);
    try {
        await client.connect();
        const db = client.db();

        const TMP    = "marketplace_v1_tmp";
        const LIVE   = "marketplace_v1";
        const BACKUP = "marketplace_v1_backup";

        const collectionNames = (await db.listCollections().toArray()).map(c => c.name);
        const exists = (name: string) => collectionNames.includes(name);

        // Populate tmp collection
        if (exists(TMP)) {
            await db.collection(TMP).drop();
        }
        await db.createCollection(TMP);
        if (catalog.items.length > 0) {
            await db.collection(TMP).insertMany(catalog.items.map(item => ({ ...item })));
        }
        console.log(`Inserted ${catalog.items.length} items into ${TMP}`);

        // Rotate: drop backup, live → backup, tmp → live
        if (exists(BACKUP)) {
            await db.collection(BACKUP).drop();
            console.log(`Dropped ${BACKUP}`);
        }
        if (exists(LIVE)) {
            await db.collection(LIVE).rename(BACKUP);
            console.log(`Renamed ${LIVE} → ${BACKUP}`);
        }
        await db.collection(TMP).rename(LIVE);
        console.log(`Renamed ${TMP} → ${LIVE}`);

        console.log("\nDeploy complete.");
    } finally {
        await client.close();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
