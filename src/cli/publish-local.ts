#!/usr/bin/env node
/**
 * publish-local — Prepares marketplace-build/publish-local for local serving.
 *
 * Mirrors what release:publish does for marketplace-media-store, but:
 *   - Outputs to marketplace-build/publish-local/{scope}/{version}/
 *   - Resolves ew-marketplace:// URLs to http://localhost:3131/{scope}/{version}/media/
 *   - Does not commit, push, or touch build.number
 *
 * Serve the result with: npm run publish-local:serve
 *
 * Usage:
 *   npx tsx src/cli/publish-local.ts --scope dev
 *   npx tsx src/cli/publish-local.ts            # prompts for scope
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import JSZip from "jszip";
import type {
    IEverMarketplaceCatalog,
    IEverMarketplaceCatalogItem,
    IEverMarketplaceMarkdown,
    IEverMarketplaceUrl,
} from "../model/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CATALOG_DIR = path.join(ROOT, "marketplace-build/catalog");
const LOCAL_CDN_DIR = path.join(ROOT, "marketplace-build/publish-local");
const CDN_BASE_URL = "http://localhost:3131";
const BUILD_NUMBER_FILE = path.join(ROOT, "build.number");

// ── scope ─────────────────────────────────────────────────────────────────────

const VALID_SCOPES = ["prod", "qa", "dev"] as const;
type PublishScope = typeof VALID_SCOPES[number];

const SCOPE_VISIBILITIES: Record<PublishScope, string[]> = {
    prod: ["prod"],
    qa:   ["prod", "qa"],
    dev:  ["prod", "qa", "dev", "template"],
};

function askScope(): Promise<PublishScope> {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = () => {
            rl.question(`Publishing scope [${VALID_SCOPES.join(" / ")}] (default: dev): `, answer => {
                const normalized = (answer.trim().toLowerCase() || "dev") as PublishScope;
                if ((VALID_SCOPES as readonly string[]).includes(normalized)) {
                    rl.close();
                    resolve(normalized);
                } else {
                    console.error(`  Invalid scope "${answer}". Must be one of: ${VALID_SCOPES.join(", ")}`);
                    ask();
                }
            });
        };
        ask();
    });
}

// ── versioning ────────────────────────────────────────────────────────────────

function currentVersion(): string {
    const n = fs.existsSync(BUILD_NUMBER_FILE)
        ? parseInt(fs.readFileSync(BUILD_NUMBER_FILE, "utf-8").trim(), 10) || 0
        : 0;
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    return `${date}-${n}`;
}

// ── ref resolution ────────────────────────────────────────────────────────────

const EW_SCHEME = "ew-marketplace://";

function resolveUrl(url: IEverMarketplaceUrl, cdnVersionUrl: string): IEverMarketplaceUrl {
    if (url.startsWith(EW_SCHEME)) {
        return `${cdnVersionUrl}/media/${url.slice(EW_SCHEME.length)}` as IEverMarketplaceUrl;
    }
    return url;
}

function resolveMarkdown(md: IEverMarketplaceMarkdown, cdnVersionUrl: string): IEverMarketplaceMarkdown {
    if (typeof md === "string") return md;
    return { href: resolveUrl(md.href, cdnVersionUrl) };
}

function resolveItem(item: IEverMarketplaceCatalogItem, cdnVersionUrl: string): IEverMarketplaceCatalogItem {
    return {
        ...item,
        cardDescription: resolveMarkdown(item.cardDescription, cdnVersionUrl),
        fullDescription:  resolveMarkdown(item.fullDescription, cdnVersionUrl),
        heroMedia: {
            ...item.heroMedia,
            url: resolveUrl(item.heroMedia.url, cdnVersionUrl),
            ...(item.heroMedia.thumbnailUrl && { thumbnailUrl: resolveUrl(item.heroMedia.thumbnailUrl, cdnVersionUrl) }),
        },
        bundle: { href: resolveUrl(item.bundle.href, cdnVersionUrl) },
        ...(item.techSpecsUrl && { techSpecsUrl: resolveUrl(item.techSpecsUrl, cdnVersionUrl) }),
        primaryApps: item.primaryApps.map(app => ({ ...app, logoUrl: resolveUrl(app.logoUrl, cdnVersionUrl) })),
        apps:        item.apps.map(app => ({ ...app, logoUrl: resolveUrl(app.logoUrl, cdnVersionUrl) })),
    };
}

// ── scope index.json ──────────────────────────────────────────────────────────

function rebuildScopeIndexes(): void {
    for (const scope of VALID_SCOPES) {
        const scopeDir = path.join(LOCAL_CDN_DIR, scope);
        fs.mkdirSync(scopeDir, { recursive: true });

        const compareNumericStrings = (s1: string, s2: string) => {
            const x1 = Number.parseInt(s1);
            const x2 = Number.parseInt(s2);
            if (x1 < x2) return -1;
            if (x1 > x2) return 1;
            return 0;
        };
        const compareVersions = (v1: string, v2: string) => {
            const parts1 = v1.split("-");
            const parts2 = v2.split("-");
            for (let i = 0; i < parts1.length; i++) {
                const result = compareNumericStrings(parts1[i], parts2[i]);
                if (result != 0) return result;
            }
            return 0;
        };

        const versions = fs.existsSync(scopeDir)
            ? fs.readdirSync(scopeDir)
                .filter(d => /^\d{4}-\d{2}-\d{2}-\d+$/.test(d) && fs.statSync(path.join(scopeDir, d)).isDirectory())
                .sort(compareVersions)
                .reverse()
            : [];

        const index = {
            scope,
            lastModified: new Date().toISOString(),
            versions,
        };
        fs.writeFileSync(path.join(scopeDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
        console.log(`  Rebuilt ${scope}/index.json (${versions.length} versions)`);
    }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    program
        .option("--scope <scope>", `publishing scope: ${VALID_SCOPES.join(", ")} (case-insensitive)`)
        .parse();

    const opts = program.opts<{ scope?: string }>();

    let scope: PublishScope;
    if (opts.scope) {
        const normalized = opts.scope.trim().toLowerCase();
        if (!(VALID_SCOPES as readonly string[]).includes(normalized)) {
            console.error(`Error: invalid scope "${opts.scope}". Must be one of: ${VALID_SCOPES.join(", ")}`);
            process.exit(1);
        }
        scope = normalized as PublishScope;
    } else {
        scope = await askScope();
    }

    // Load catalog
    const catalogJsonPath = path.join(CATALOG_DIR, "catalog.json");
    if (!fs.existsSync(catalogJsonPath)) {
        console.error(`Error: ${catalogJsonPath} not found. Run "npm run release:build" first.`);
        process.exit(1);
    }
    const catalog = JSON.parse(fs.readFileSync(catalogJsonPath, "utf-8")) as IEverMarketplaceCatalog;

    // Filter items by scope visibility rules
    const allowed = new Set(SCOPE_VISIBILITIES[scope]);
    const filteredItems = catalog.items.filter(item =>
        item.visibility !== undefined && allowed.has(item.visibility.toLowerCase()),
    );
    console.log(`Scope "${scope}": ${filteredItems.length} of ${catalog.items.length} items match (visibilities: ${[...allowed].join(", ")})`);

    // Use current build number (no increment)
    const version = currentVersion();
    console.log(`Version: ${version}`);

    // CDN URL for this version
    const cdnVersionUrl = `${CDN_BASE_URL}/${scope}/${version}`;

    // Resolve all ew-marketplace:// URLs to local CDN
    const resolvedCatalog: IEverMarketplaceCatalog = {
        ...catalog,
        items: filteredItems.map(item => resolveItem(item, cdnVersionUrl)),
    };
    const resolvedCatalogJson = JSON.stringify(resolvedCatalog, null, 2) + "\n";

    // Target: marketplace-build/publish-local/{scope}/{version}/
    const versionDir = path.join(LOCAL_CDN_DIR, scope, version);

    if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
        console.log(`Removed existing ${versionDir}`);
    }
    fs.mkdirSync(versionDir, { recursive: true });

    // catalog.json
    fs.writeFileSync(path.join(versionDir, "catalog.json"), resolvedCatalogJson);

    // catalog.zip
    const zip = new JSZip();
    zip.file("catalog.json", resolvedCatalogJson);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    fs.writeFileSync(path.join(versionDir, "catalog.zip"), zipBuffer);

    console.log(`Wrote catalog.json + catalog.zip (${resolvedCatalog.items.length} items)`);

    // media/{item}/ — copy all files from marketplace-build/catalog/{id}/
    const mediaDir = path.join(versionDir, "media");
    fs.mkdirSync(mediaDir, { recursive: true });

    for (const item of resolvedCatalog.items) {
        const srcDir = path.join(CATALOG_DIR, item.id);
        if (!fs.existsSync(srcDir)) {
            console.warn(`  [warn] No catalog directory for ${item.id}, skipping media.`);
            continue;
        }
        const destDir = path.join(mediaDir, item.id);
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
            if (file === "index.json") continue;
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
    }
    console.log(`Copied media for ${resolvedCatalog.items.length} items`);

    // media/defaults/ — copy default assets
    const defaultsSrcDir = path.join(ROOT, "defaults");
    if (fs.existsSync(defaultsSrcDir)) {
        const defaultsDestDir = path.join(mediaDir, "defaults");
        fs.mkdirSync(defaultsDestDir, { recursive: true });
        for (const file of fs.readdirSync(defaultsSrcDir)) {
            fs.copyFileSync(path.join(defaultsSrcDir, file), path.join(defaultsDestDir, file));
        }
        console.log(`Copied defaults/ (${fs.readdirSync(defaultsDestDir).length} files)`);
    }

    // media/apps/ — copy all app assets
    const appsSrcDir = path.join(ROOT, "src", "apps");
    const appsDestDir = path.join(mediaDir, "apps");
    fs.mkdirSync(appsDestDir, { recursive: true });
    for (const file of fs.readdirSync(appsSrcDir)) {
        fs.copyFileSync(path.join(appsSrcDir, file), path.join(appsDestDir, file));
    }
    console.log(`Copied ${fs.readdirSync(appsDestDir).length} app assets`);

    // Rebuild all scope index.json files
    rebuildScopeIndexes();

    console.log(`\nLocal marketplace ready at ${cdnVersionUrl}/catalog.json`);
    console.log(`Run "npm run publish-local:serve" to serve on ${CDN_BASE_URL}`);
}

main().catch(err => { console.error(err); process.exit(1); });
