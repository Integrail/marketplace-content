#!/usr/bin/env node
/**
 * release:publish — Publishes the built catalog to the marketplace-media-store repository.
 *
 * Reads from:   marketplace-build/catalog/
 * Publishes to: ../marketplace-media-store/cdn/{scope}/{version}/
 * CDN base URL: https://marketplace-media.everworker.ai/{scope}/{version}
 *
 * Usage:
 *   npx tsx src/cli/publish-catalog.ts --scope prod
 *   npx tsx src/cli/publish-catalog.ts            # prompts for scope
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
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
const CATALOG_DIR  = path.join(ROOT, "marketplace-build/catalog");
const MEDIA_STORE_DIR = path.resolve(ROOT, "../marketplace-media-store");
const MEDIA_STORE_ORIGIN = "git@github.com:Integrail/marketplace-media-store.git";
const CDN_BASE_URL = "https://marketplace-media.everworker.ai";
const BUILD_NUMBER_FILE = path.join(ROOT, "build.number");

// ── scope ─────────────────────────────────────────────────────────────────────

const VALID_SCOPES = ["prod", "qa", "dev"] as const;
type PublishScope = typeof VALID_SCOPES[number];

/** Visibility values included per scope (lower scopes are subsets of broader ones). */
const SCOPE_VISIBILITIES: Record<PublishScope, string[]> = {
    prod: ["prod"],
    qa:   ["prod", "qa"],
    dev:  ["prod", "qa", "dev", "template"],
};

function askScope(): Promise<PublishScope> {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = () => {
            rl.question(`Publishing scope [${VALID_SCOPES.join(" / ")}]: `, answer => {
                const normalized = answer.trim().toLowerCase() as PublishScope;
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

function nextVersion(): string {
    const n = fs.existsSync(BUILD_NUMBER_FILE)
        ? parseInt(fs.readFileSync(BUILD_NUMBER_FILE, "utf-8").trim(), 10) || 0
        : 0;
    const next = n + 1;
    fs.writeFileSync(BUILD_NUMBER_FILE, String(next), "utf-8");
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    return `${date}-${next}`;
}

// ── git helpers ───────────────────────────────────────────────────────────────

function git(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function isGitRepo(dir: string): boolean {
    try { git(dir, "rev-parse", "--is-inside-work-tree"); return true; } catch { return false; }
}

function normalizeGitUrl(url: string): string {
    return url.trim()
        .replace(/\.git$/, "")
        .replace(/^ssh:\/\/[^@]+@/, "")
        .replace(/^[^@]+@([^:]+):/, "$1/")
        .replace(/^https?:\/\//, "");
}

function ensureMediaStore(branch: string): void {
    if (fs.existsSync(MEDIA_STORE_DIR)) {
        if (!isGitRepo(MEDIA_STORE_DIR)) {
            console.error(`Error: ${MEDIA_STORE_DIR} exists but is not a git repository. Remove it and retry.`);
            process.exit(1);
        }
        const origin = normalizeGitUrl(git(MEDIA_STORE_DIR, "remote", "get-url", "origin"));
        if (origin !== normalizeGitUrl(MEDIA_STORE_ORIGIN)) {
            console.error(`Error: ${MEDIA_STORE_DIR} points to a different origin (${origin}). Remove it and retry.`);
            process.exit(1);
        }
        console.log(`Updating media-store at ${MEDIA_STORE_DIR}...`);
        git(MEDIA_STORE_DIR, "fetch", "origin");
        git(MEDIA_STORE_DIR, "checkout", branch);
        git(MEDIA_STORE_DIR, "reset", "--hard", `origin/${branch}`);
    } else {
        console.log(`Cloning ${MEDIA_STORE_ORIGIN} into ${MEDIA_STORE_DIR}...`);
        execFileSync("git", ["clone", "--branch", branch, MEDIA_STORE_ORIGIN, MEDIA_STORE_DIR], {
            encoding: "utf-8",
            stdio: "inherit",
        });
    }
    execFileSync("git", ["lfs", "install"], { cwd: MEDIA_STORE_DIR, encoding: "utf-8" });
    git(MEDIA_STORE_DIR, "lfs", "fetch", "origin", branch);
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
    const cdnDir = path.join(MEDIA_STORE_DIR, "cdn");
    for (const scope of VALID_SCOPES) {
        const scopeDir = path.join(cdnDir, scope);
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

        // Collect all version directories (YYYY-MM-DD-N format)
        const versions = fs.existsSync(scopeDir)
            ? fs.readdirSync(scopeDir)
                .filter(d => /^\d{4}-\d{2}-\d{2}-\d+$/.test(d) && fs.statSync(path.join(scopeDir, d)).isDirectory())
                .sort(compareVersions)
                .reverse()  // latest first
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
        .option("--branch <branch>", "branch in marketplace-media-store to publish to", "main")
        .parse();

    const opts = program.opts<{ scope?: string; branch: string; force: boolean }>();
    const { branch, force } = opts;

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

    // Pull latest marketplace-content
    const marketplaceContentBranch = git(ROOT, "rev-parse", "--abbrev-ref", "HEAD");
    git(ROOT, "pull", "origin", marketplaceContentBranch);
    git(ROOT, "lfs", "pull", "origin", marketplaceContentBranch);

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

    // Determine version
    const version = nextVersion();
    console.log(`Version: ${version}`);

    // Commit build.number and push to marketplace-content
    git(ROOT, "reset", "HEAD"); // unstage any existing changes to avoid accidental commits of unrelated changes
    git(ROOT, "add", "build.number");
    git(ROOT, "commit", "-m", `chore: bump build number to ${version}`);
    git(ROOT, "push", "origin", marketplaceContentBranch);
    console.log(`Pushed build number update to origin/${marketplaceContentBranch}`);

    // CDN URL for this version
    const cdnVersionUrl = `${CDN_BASE_URL}/${scope}/${version}`;

    // Resolve all ew-marketplace:// URLs to CDN
    const resolvedCatalog: IEverMarketplaceCatalog = {
        ...catalog,
        items: filteredItems.map(item => resolveItem(item, cdnVersionUrl)),
    };
    const resolvedCatalogJson = JSON.stringify(resolvedCatalog, null, 2) + "\n";

    // Ensure media-store is ready
    ensureMediaStore(branch);

    // Target: cdn/{scope}/{version}/
    const versionDir = path.join(MEDIA_STORE_DIR, "cdn", scope, version);

    // Remove existing version dir if present (fresh publish)
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
            if (file === "index.json") continue;  // catalog.json is the source of truth
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

    // Commit and push
    git(MEDIA_STORE_DIR, "add", "-A");

    let hasChanges = true;
    try {
        git(MEDIA_STORE_DIR, "diff", "--cached", "--quiet");
        hasChanges = false;
    } catch { /* non-zero = staged changes exist */ }

    if (!hasChanges) {
        console.log("\nNothing to commit — already up to date.");
    } else {
        const message = `chore: publish catalog ${version} to ${scope} (${catalog.catalogVersion})`;
        git(MEDIA_STORE_DIR, "commit", "-m", message);
        console.log(`\nCommitted: ${message}`);
        execFileSync("bash", ["git-push.sh"], { cwd: MEDIA_STORE_DIR, encoding: "utf-8", stdio: "inherit" });
        console.log(`Pushed to origin/${branch}`);

        // Wait for CDN to propagate the new files before reporting success.
        // GitHub Pages and git-backed CDNs typically take 5–30s after a push.
        const catalogUrl = `${cdnVersionUrl}/catalog.json`;
        process.stdout.write(`\nWaiting for CDN to propagate ${catalogUrl} ...`);
        for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
                const res = await fetch(catalogUrl, { method: "HEAD" });
                if (res.ok) { process.stdout.write(" ready.\n"); break; }
            } catch { /* network error, keep waiting */ }
            process.stdout.write(".");
            if (attempt === 59) { process.stdout.write(" timed out (CDN may still be propagating).\n"); }
        }
    }

    console.log(`\nPublished: ${cdnVersionUrl}/catalog.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
