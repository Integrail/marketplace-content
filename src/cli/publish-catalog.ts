#!/usr/bin/env node
/**
 * Publishes the built catalog to the marketplace-media-store repository.
 *
 * Usage:
 *   npx tsx src/cli/publish-catalog.ts --environment qa
 *   npx tsx src/cli/publish-catalog.ts --environment prod --branch release --no-push
 *   npx tsx src/cli/publish-catalog.ts --environment dev-0 --media-store-url https://my-cdn.example.com
 */

import fs from "node:fs";
import path from "node:path";
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
const CATALOG_DIR = path.join(ROOT, "catalog");
const MEDIA_STORE_DIR = path.join(ROOT, "media-store");
const MEDIA_STORE_ORIGIN = "https://github.com/Integrail/marketplace-media-store";

// ── git helpers ───────────────────────────────────────────────────────────────

function git(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function isGitRepo(dir: string): boolean {
    try {
        git(dir, "rev-parse", "--is-inside-work-tree");
        return true;
    } catch {
        return false;
    }
}

function getOrigin(dir: string): string {
    try {
        return git(dir, "remote", "get-url", "origin");
    } catch {
        return "";
    }
}

/** Strips protocol, auth, and .git suffix so URLs can be compared repo-to-repo. */
function normalizeGitUrl(url: string): string {
    return url
        .trim()
        .replace(/\.git$/, "")
        .replace(/^ssh:\/\/[^@]+@/, "")     // ssh://git@github.com/… → github.com/…
        .replace(/^[^@]+@([^:]+):/, "$1/")  // git@github.com:… → github.com/…
        .replace(/^https?:\/\//, "");       // https://github.com/… → github.com/…
}

// ── media-store setup ─────────────────────────────────────────────────────────

function ensureMediaStore(branch: string): void {
    if (fs.existsSync(MEDIA_STORE_DIR)) {
        if (!isGitRepo(MEDIA_STORE_DIR)) {
            console.error(`Error: ${MEDIA_STORE_DIR} exists but is not a git repository. Remove it and retry.`);
            process.exit(1);
        }
        const origin = normalizeGitUrl(getOrigin(MEDIA_STORE_DIR));
        if (origin !== normalizeGitUrl(MEDIA_STORE_ORIGIN)) {
            console.error(`Error: ${MEDIA_STORE_DIR} points to a different origin (${origin}). Remove it and retry.`);
            process.exit(1);
        }
        console.log(`Using existing media-store at ${MEDIA_STORE_DIR}`);
        git(MEDIA_STORE_DIR, "fetch", "origin");
        git(MEDIA_STORE_DIR, "checkout", branch);
        git(MEDIA_STORE_DIR, "reset", "--hard", `origin/${branch}`);
    } else {
        console.log(`Cloning ${MEDIA_STORE_ORIGIN} into ${MEDIA_STORE_DIR}`);
        execFileSync("git", ["clone", "--branch", branch, MEDIA_STORE_ORIGIN, MEDIA_STORE_DIR], {
            encoding: "utf-8",
            stdio: "inherit",
        });
    }
}

// ── ref resolution ────────────────────────────────────────────────────────────

const EW_MARKETPLACE_SCHEME = "ew-marketplace://";

function resolveUrl(url: IEverMarketplaceUrl, mediaStoreUrl: string): IEverMarketplaceUrl {
    if (url.startsWith(EW_MARKETPLACE_SCHEME)) {
        return `${mediaStoreUrl}/${url.slice(EW_MARKETPLACE_SCHEME.length)}` as IEverMarketplaceUrl;
    }
    return url;
}

function resolveMarkdown(md: IEverMarketplaceMarkdown, mediaStoreUrl: string): IEverMarketplaceMarkdown {
    if (typeof md === "string") return md;
    return { href: resolveUrl(md.href, mediaStoreUrl) };
}

function resolveItem(item: IEverMarketplaceCatalogItem, mediaStoreUrl: string): IEverMarketplaceCatalogItem {
    return {
        ...item,
        cardDescription: resolveMarkdown(item.cardDescription, mediaStoreUrl),
        fullDescription: resolveMarkdown(item.fullDescription, mediaStoreUrl),
        heroMedia: {
            ...item.heroMedia,
            url: resolveUrl(item.heroMedia.url, mediaStoreUrl),
            ...(item.heroMedia.thumbnailUrl && { thumbnailUrl: resolveUrl(item.heroMedia.thumbnailUrl, mediaStoreUrl) }),
        },
        bundle: { href: resolveUrl(item.bundle.href, mediaStoreUrl) },
        ...(item.techSpecsUrl && { techSpecsUrl: resolveUrl(item.techSpecsUrl, mediaStoreUrl) }),
        primaryApps: item.primaryApps.map(app => ({
            ...app,
            logoUrl: resolveUrl(app.logoUrl, mediaStoreUrl),
            description: resolveUrl(app.description, mediaStoreUrl),
        })),
        apps: item.apps.map(app => ({
            ...app,
            logoUrl: resolveUrl(app.logoUrl, mediaStoreUrl),
            description: resolveUrl(app.description, mediaStoreUrl),
        })),
    };
}

// ── publish ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    program
        .requiredOption("--environment <name>", "target environment (e.g. prod, qa, dev-{ever-number})")
        .option("--branch <branch>", "branch to publish to", "main")
        .option("--no-push", "skip git push after committing")
        .option("--media-store-url <url>", "base URL for resolving ew-marketplace:// references", "https://marketplace-media.everworker.ai")
        .parse();

    const opts = program.opts<{ environment: string; branch: string; push: boolean; mediaStoreUrl: string }>();
    const { environment, branch, push, mediaStoreUrl } = opts;

    // Load catalog
    const catalogJsonPath = path.join(CATALOG_DIR, "catalog.json");
    if (!fs.existsSync(catalogJsonPath)) {
        console.error(`Error: ${catalogJsonPath} not found. Run build-catalog first.`);
        process.exit(1);
    }
    const catalogJson = fs.readFileSync(catalogJsonPath, "utf-8");
    const catalog = JSON.parse(catalogJson) as IEverMarketplaceCatalog;

    // Resolve ew-marketplace:// references
    const resolvedCatalog: IEverMarketplaceCatalog = {
        ...catalog,
        items: catalog.items.map(item => resolveItem(item, mediaStoreUrl)),
    };
    const resolvedCatalogJson = JSON.stringify(resolvedCatalog, null, 2) + "\n";

    // Ensure media-store is ready
    ensureMediaStore(branch);

    // Target directory
    const cdnDir = path.join(MEDIA_STORE_DIR, "cdn", environment);
    fs.rmSync(cdnDir, { recursive: true, force: true });
    fs.mkdirSync(cdnDir, { recursive: true });

    // catalog.json
    fs.writeFileSync(path.join(cdnDir, "catalog.json"), resolvedCatalogJson);
    console.log(`Wrote catalog.json (${resolvedCatalog.items.length} items)`);

    // catalog.zip
    const zip = new JSZip();
    zip.file("catalog.json", resolvedCatalogJson);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    fs.writeFileSync(path.join(cdnDir, "catalog.zip"), zipBuffer);
    console.log(`Wrote catalog.zip`);

    // media/{item}/
    const mediaDir = path.join(cdnDir, "media");
    fs.mkdirSync(mediaDir, { recursive: true });

    for (const item of resolvedCatalog.items) {
        const itemId = item.id;
        const srcDir = path.join(CATALOG_DIR, itemId);
        if (!fs.existsSync(srcDir)) {
            console.warn(`  [warn] No catalog directory for ${itemId}, skipping media.`);
            continue;
        }
        const destDir = path.join(mediaDir, itemId);
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
        console.log(`  Copied media/${itemId}/`);
    }

    // Git commit
    git(MEDIA_STORE_DIR, "add", "-A");

    let hasChanges = true;
    try {
        git(MEDIA_STORE_DIR, "diff", "--cached", "--quiet");
        hasChanges = false;
    } catch {
        // non-zero exit means there are staged changes
    }

    if (!hasChanges) {
        console.log("\nNothing to commit — catalog is already up to date.");
    } else {
        const date = new Date().toISOString();
        const message = `chore: publish catalog ${catalog.catalogVersion} to ${environment} (${date})`;
        git(MEDIA_STORE_DIR, "commit", "-m", message);
        console.log(`\nCommitted: ${message}`);

        if (push) {
            git(MEDIA_STORE_DIR, "push", "origin", branch);
            console.log(`Pushed to origin/${branch}`);
        } else {
            console.log(`Skipping push (--no-push).`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
