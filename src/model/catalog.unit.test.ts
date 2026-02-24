import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IEverMarketplaceCatalogItem } from './catalog.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const catalogRoot = join(__dirname, '../../catalog');

// ── Runtime constraints mirroring the TypeScript types ───────────────────────

const VALID_ITEM_TYPES = new Set<string>(['Workflow', 'Worker']);
const VALID_MEDIA_KINDS = new Set<string>(['image', 'video']);
const VERSION_RE = /^\d+\.\d+\.\d+-\d+$/;
const URL_RE = /^(ew-marketplace:\/\/|https:\/\/)\S+\/\S+/;

function assertUrl(value: unknown, field: string): void {
    assert(
        typeof value === 'string' && URL_RE.test(value),
        `${field} must be an ew-marketplace:// or https:// URL with a path (got ${JSON.stringify(value)})`,
    );
}

/** IEverMarketplaceMarkdown = string | { href: IEverMarketplaceUrl } */
function assertMarkdown(value: unknown, field: string): void {
    if (typeof value === 'string') {
        assert(value.length > 0, `${field} must be a non-empty string when inline`);
    } else {
        assert(
            typeof value === 'object' && value !== null && 'href' in value,
            `${field} must be a string or a { href } ref object`,
        );
        assertUrl((value as Record<string, unknown>).href, `${field}.href`);
    }
}

function assertSetupComponents(value: unknown, field: string): void {
    assert(Array.isArray(value), `${field} must be an array`);
    for (const [i, comp] of (value as unknown[]).entries()) {
        assert(typeof comp === 'object' && comp !== null, `${field}[${i}] must be an object`);
        const c = comp as Record<string, unknown>;
        assert(typeof c.name === 'string' && c.name.length > 0, `${field}[${i}].name must be a non-empty string`);
        assert(typeof c.description === 'string' && c.description.length > 0, `${field}[${i}].description must be a non-empty string`);
    }
}

function assertCatalogItem(raw: unknown, label: string): void {
    assert(typeof raw === 'object' && raw !== null, `${label}: must be an object`);
    const item = raw as Record<string, unknown>;

    // ── card fields ──────────────────────────────────────────────────────────
    assert(typeof item.id === 'string' && item.id.length > 0,
        `${label}: id must be a non-empty string`);
    assert(typeof item.name === 'string' && item.name.length > 0,
        `${label}: name must be a non-empty string`);
    assertMarkdown(item.description, `${label}: description`);
    assert(typeof item.itemVersion === 'string' && VERSION_RE.test(item.itemVersion),
        `${label}: itemVersion must match N.N.N-N (got ${JSON.stringify(item.itemVersion)})`);
    assert(typeof item.type === 'string' && VALID_ITEM_TYPES.has(item.type),
        `${label}: type must be one of [${[...VALID_ITEM_TYPES].join(', ')}] (got ${JSON.stringify(item.type)})`);

    assert(Array.isArray(item.categories) && item.categories.length > 0,
        `${label}: categories must be a non-empty array`);
    for (const [i, cat] of (item.categories as unknown[]).entries()) {
        assert(typeof cat === 'string' && cat.length > 0, `${label}: categories[${i}] must be a non-empty string`);
    }

    assert(Array.isArray(item.tags), `${label}: tags must be an array`);
    for (const [i, tag] of (item.tags as unknown[]).entries()) {
        assert(typeof tag === 'string' && tag.length > 0, `${label}: tags[${i}] must be a non-empty string`);
    }

    assertUrl(item.iconUrl, `${label}: iconUrl`);

    assert(typeof item.author === 'object' && item.author !== null, `${label}: author must be an object`);
    const author = item.author as Record<string, unknown>;
    assert(typeof author.name === 'string' && author.name.length > 0, `${label}: author.name must be a non-empty string`);
    assertUrl(author.avatarUrl, `${label}: author.avatarUrl`);

    if (item.keyBenefit !== undefined) {
        assert(typeof item.keyBenefit === 'string' && item.keyBenefit.length > 0,
            `${label}: keyBenefit must be a non-empty string when present`);
    }

    assert(Array.isArray(item.integrations), `${label}: integrations must be an array`);
    for (const [i, integration] of (item.integrations as unknown[]).entries()) {
        assert(typeof integration === 'object' && integration !== null, `${label}: integrations[${i}] must be an object`);
        const ig = integration as Record<string, unknown>;
        assert(typeof ig.name === 'string' && ig.name.length > 0, `${label}: integrations[${i}].name must be a non-empty string`);
        assertUrl(ig.logoUrl, `${label}: integrations[${i}].logoUrl`);
    }

    // ── detail view fields ───────────────────────────────────────────────────
    assert(typeof item.heroMedia === 'object' && item.heroMedia !== null,
        `${label}: heroMedia must be an object`);
    const media = item.heroMedia as Record<string, unknown>;
    assert(typeof media.kind === 'string' && VALID_MEDIA_KINDS.has(media.kind),
        `${label}: heroMedia.kind must be one of [${[...VALID_MEDIA_KINDS].join(', ')}]`);
    assertUrl(media.url, `${label}: heroMedia.url`);
    if (media.kind === 'video') {
        assertUrl(media.thumbnailUrl, `${label}: heroMedia.thumbnailUrl (required for video)`);
    }
    if (media.thumbnailUrl !== undefined) {
        assertUrl(media.thumbnailUrl, `${label}: heroMedia.thumbnailUrl`);
    }

    assertMarkdown(item.overview, `${label}: overview`);
    assertMarkdown(item.howItWorks, `${label}: howItWorks`);

    assert(typeof item.setupOverview === 'object' && item.setupOverview !== null,
        `${label}: setupOverview must be an object`);
    const setup = item.setupOverview as Record<string, unknown>;
    assert(typeof setup.setupTime === 'string' && setup.setupTime.length > 0,
        `${label}: setupOverview.setupTime must be a non-empty string`);
    assertSetupComponents(setup.connectors,  `${label}: setupOverview.connectors`);
    assertSetupComponents(setup.memories,    `${label}: setupOverview.memories`);
    assertSetupComponents(setup.collections, `${label}: setupOverview.collections`);
    assertSetupComponents(setup.workflows,   `${label}: setupOverview.workflows`);

    if (item.techSpecsUrl !== undefined) assertUrl(item.techSpecsUrl, `${label}: techSpecsUrl`);
    if (item.supportUrl !== undefined)   assertUrl(item.supportUrl,   `${label}: supportUrl`);

    // TypeScript satisfaction — keeps runtime shape aligned with the static type
    const _typed: IEverMarketplaceCatalogItem = item as unknown as IEverMarketplaceCatalogItem;
    void _typed;
}

// ── Test runner ──────────────────────────────────────────────────────────────

function loadCatalogItems(): Array<{ id: string; raw: unknown }> {
    return readdirSync(catalogRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(dir => ({
            id: dir.name,
            raw: JSON.parse(readFileSync(join(catalogRoot, dir.name, 'index.json'), 'utf-8')),
        }));
}

describe('catalog items', () => {
    const items = loadCatalogItems();

    assert(items.length > 0, 'No catalog items found — add at least one item under catalog/');

    for (const { id, raw } of items) {
        it(`${id} satisfies IEverMarketplaceCatalogItem`, () => {
            assertCatalogItem(raw, id);
        });
    }
});
