#!/usr/bin/env node
/**
 * Builds a marketplace distribution ZIP.
 *
 * Usage:
 *   npm run marketplace-package              # demo mode (default)
 *   npm run marketplace-package -- prod      # production mode
 *
 * Output:
 *   ./marketplace-dist/everworker-marketplace-{YYYY}-{M}-{D}-{H}.zip
 *
 * ZIP contents:
 *   index.json          — catalog manifest (items list + metadata)
 *   MW-XXXX.json        — one file per catalog item (full combined data)
 *
 * Media (non-text files):
 *   demo — copied to ./marketplace-dist/everworker-marketplace-{...}-s3/
 *   prod — stub: log paths that would be uploaded to S3
 *
 * Environment variables (prod mode):
 *   S3_BASE_URL   Base URL for S3 media (e.g. https://s3.amazonaws.com/my-bucket)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CATALOG_DIR = path.join(ROOT, 'catalog');
const DIST_DIR = path.join(ROOT, 'marketplace-dist');

const mode = (process.argv[2] ?? 'demo') as 'demo' | 'prod';
if (mode !== 'demo' && mode !== 'prod') {
    console.error(`Invalid mode: "${mode}". Use "demo" or "prod".`);
    process.exit(1);
}

const TEXT_EXTS = new Set(['.json', '.md', '.txt', '.html', '.css', '.js', '.ts', '.yaml', '.yml']);

function isMediaFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return !TEXT_EXTS.has(ext);
}

function buildDistName(): string {
    const now = new Date();
    return `everworker-marketplace-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
}

/** Recursively walk a JSON value and replace all ew-marketplace:// URL strings. */
function replaceUrls(obj: unknown, replacer: (url: string) => string): unknown {
    if (typeof obj === 'string') {
        return obj.startsWith('ew-marketplace://') ? replacer(obj) : obj;
    }
    if (Array.isArray(obj)) return obj.map((v) => replaceUrls(v, replacer));
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, replaceUrls(v, replacer)]),
        );
    }
    return obj;
}

/** Parse ew-marketplace://itemId/path/to/file → { itemId, filePath } */
function parseEwUrl(url: string): { itemId: string; filePath: string } | null {
    const without = url.slice('ew-marketplace://'.length);
    const slash = without.indexOf('/');
    if (slash < 0) return null;
    return { itemId: without.slice(0, slash), filePath: without.slice(slash + 1) };
}

interface ManifestItem {
    id: string;
    file: string;
    name: string;
    type: string;
    categories: string[];
}

interface Manifest {
    version: string;
    generatedAt: string;
    mode: string;
    s3BaseUrl: string;
    items: ManifestItem[];
}

async function main() {
    const distName = buildDistName();
    const zipPath = path.join(DIST_DIR, `${distName}.zip`);
    const s3Dir = path.join(DIST_DIR, `${distName}-s3`);
    const s3BaseUrl =
        mode === 'demo'
            ? `file://${s3Dir}`
            : (process.env.S3_BASE_URL ?? `https://s3.amazonaws.com/everworker-marketplace/${distName}`);

    console.log(`Building: ${distName}`);
    console.log(`  Mode:   ${mode}`);
    console.log(`  Output: ${zipPath}`);
    if (mode === 'demo') console.log(`  S3 sim: ${s3Dir}\n`);
    else console.log();

    fs.mkdirSync(DIST_DIR, { recursive: true });

    const itemDirs = fs
        .readdirSync(CATALOG_DIR)
        .filter((d) => fs.statSync(path.join(CATALOG_DIR, d)).isDirectory())
        .sort();

    const zip = new JSZip();
    const manifestItems: ManifestItem[] = [];
    let processed = 0;
    let skipped = 0;

    for (const itemId of itemDirs) {
        const itemDir = path.join(CATALOG_DIR, itemId);
        const indexPath = path.join(itemDir, 'index.json');

        if (!fs.existsSync(indexPath)) {
            console.warn(`  [skip] No index.json: ${itemId}`);
            skipped++;
            continue;
        }

        const rawItem = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, unknown>;

        // Resolve howItWorks ref → inline markdown string
        const hiw = rawItem.howItWorks;
        if (hiw && typeof hiw === 'object' && 'href' in hiw && typeof (hiw as { href: unknown }).href === 'string') {
            const parsed = parseEwUrl((hiw as { href: string }).href);
            if (parsed) {
                const mdPath = path.join(CATALOG_DIR, parsed.itemId, parsed.filePath);
                if (fs.existsSync(mdPath)) rawItem.howItWorks = fs.readFileSync(mdPath, 'utf8');
            }
        }

        // Resolve overview ref → inline markdown string
        const ov = rawItem.overview;
        if (ov && typeof ov === 'object' && 'href' in ov && typeof (ov as { href: unknown }).href === 'string') {
            const parsed = parseEwUrl((ov as { href: string }).href);
            if (parsed) {
                const ovPath = path.join(CATALOG_DIR, parsed.itemId, parsed.filePath);
                if (fs.existsSync(ovPath)) rawItem.overview = fs.readFileSync(ovPath, 'utf8');
            }
        }

        // Copy media files to S3 sim dir (demo) / log for upload (prod)
        let mediaCount = 0;
        for (const file of fs.readdirSync(itemDir)) {
            if (!isMediaFile(file)) continue;
            const src = path.join(itemDir, file);
            if (mode === 'demo') {
                const destDir = path.join(s3Dir, itemId);
                fs.mkdirSync(destDir, { recursive: true });
                fs.copyFileSync(src, path.join(destDir, file));
            } else {
                console.log(`  [s3-upload] ${itemId}/${file}`);
            }
            mediaCount++;
        }

        // Replace ew-marketplace:// URLs with S3 URLs
        const resolvedItem = replaceUrls(rawItem, (url) => {
            const parsed = parseEwUrl(url);
            if (!parsed) return url;
            return `${s3BaseUrl}/${parsed.itemId}/${parsed.filePath}`;
        });

        const itemFileName = `${itemId}.json`;
        zip.file(itemFileName, JSON.stringify(resolvedItem, null, 2));

        manifestItems.push({
            id: itemId,
            file: itemFileName,
            name: rawItem.name as string,
            type: rawItem.type as string,
            categories: (rawItem.categories as string[]) ?? [],
        });

        const mediaSuffix = mediaCount > 0 ? ` (${mediaCount} media)` : '';
        console.log(`  ✓ ${itemId}: ${rawItem.name}${mediaSuffix}`);
        processed++;
    }

    const manifest: Manifest = {
        version: distName.replace('everworker-marketplace-', ''),
        generatedAt: new Date().toISOString(),
        mode,
        s3BaseUrl,
        items: manifestItems,
    };
    zip.file('index.json', JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    fs.writeFileSync(zipPath, zipBuffer);

    const sizeKb = (zipBuffer.length / 1024).toFixed(1);
    console.log(`\nDone: ${processed} packaged, ${skipped} skipped.`);
    console.log(`  ZIP: ${zipPath} (${sizeKb} KB)`);
    if (mode === 'demo' && processed > 0) console.log(`  S3:  ${s3Dir}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
