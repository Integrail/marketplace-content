import assert from "node:assert/strict";
import SpellChecker from "simple-spellchecker";
import {
    IEverMarketplaceAppDefinition,
    IEverMarketplaceCatalogItem,
    IEverMarketplaceMarkdown,
    IEverMarketplaceMedia,
    IEverMarketplaceRef,
} from "../model/catalog";
import { CatalogItemResult, MARKDOWN_EXTRACTION_CUTOFF } from "./catalog-build";

// ── Result types ──────────────────────────────────────────────────────────────

export type ValidationWarning = { field: string; message: string };
export type ValidationResult  = { warnings: ValidationWarning[] };

// ── Spell-check ───────────────────────────────────────────────────────────────

function spellCheckText(text: string, field: string): ValidationWarning[] {
    const dict = SpellChecker.getDictionarySync("en-US");
    const uniqueWords = [...new Set(text.match(/[a-zA-Z]{2,}/g) ?? [])];
    return uniqueWords
        .filter(word => dict.isMisspelled(word))
        .map(word => ({ field, message: `"${word}" may be misspelled` }));
}

// ── Patterns & constant sets ──────────────────────────────────────────────────

const VERSION_RE = /^\d+\.\d+\.\d+-\d+$/;
/** Matches ew-marketplace://, http://, or https:// followed by a host and a slash. */
const URL_RE = /^(ew-marketplace|https?):\/\/[^\s/]+\/\S*/;
const ITEM_TYPES = new Set(["Worker", "Workflow"]);
const DEPENDENCY_TYPES = new Set(["connector", "memory", "collection", "workflow"]);
const APP_IDS = new Set(["GMail", "NetSuite", "QuickBooks"]);

// ── Primitive helpers ─────────────────────────────────────────────────────────

export function assertUrl(value: unknown, field: string): void {
    assert(
        typeof value === "string" && URL_RE.test(value),
        `${field}: expected a valid URL (ew-marketplace://, http://, or https://) with a host and path, got ${JSON.stringify(value)}`,
    );
}

export function assertVersion(value: unknown, field: string): void {
    assert(
        typeof value === "string" && VERSION_RE.test(value),
        `${field}: expected version format N.N.N-N, got ${JSON.stringify(value)}`,
    );
}

// ── Structural helpers ────────────────────────────────────────────────────────

/** IEverMarketplaceMarkdown = string | { href: IEverMarketplaceUrl } */
export function assertMarkdown(value: unknown, field: string): void {
    if (typeof value === "string") {
        assert(value.length > 0, `${field}: inline markdown must be a non-empty string`);
        return;
    }
    assert(
        typeof value === "object" && value !== null && "href" in value,
        `${field}: expected a non-empty string or { href } ref object, got ${JSON.stringify(value)}`,
    );
    assertUrl((value as Record<string, unknown>).href, `${field}.href`);
}

export function assertRef(value: IEverMarketplaceRef, field: string): void {
    assertUrl(value.href, `${field}.href`);
}

export function assertMedia(value: IEverMarketplaceMedia, field: string): void {
    assert(
        value.kind === "image" || value.kind === "video",
        `${field}.kind: expected "image" or "video", got ${JSON.stringify(value.kind)}`,
    );
    assertUrl(value.url, `${field}.url`);
    if (value.kind === "video") {
        assert(
            value.thumbnailUrl !== undefined,
            `${field}.thumbnailUrl: required when kind is "video"`,
        );
    }
    if (value.thumbnailUrl !== undefined) {
        assertUrl(value.thumbnailUrl, `${field}.thumbnailUrl`);
    }
}

export function assertAppDefinition(value: IEverMarketplaceAppDefinition, field: string): void {
    assert(
        APP_IDS.has(value.appId),
        `${field}.appId: expected one of ${[...APP_IDS].join(", ")}, got ${JSON.stringify(value.appId)}`,
    );
    assert(
        typeof value.name === "string" && value.name.length > 0,
        `${field}.name: expected a non-empty string`,
    );
    assertUrl(value.logoUrl, `${field}.logoUrl`);
    assertUrl(value.description, `${field}.description`);
}

export function assertDependencyGroup(value: unknown, field: string): void {
    assert(typeof value === "object" && value !== null, `${field}: expected an object`);
    const g = value as Record<string, unknown>;
    assert(
        DEPENDENCY_TYPES.has(g.type as string),
        `${field}.type: expected one of ${[...DEPENDENCY_TYPES].join(", ")}, got ${JSON.stringify(g.type)}`,
    );
    assert(typeof g.summary === "string", `${field}.summary: expected a string`);
    assert(Array.isArray(g.items), `${field}.items: expected an array`);
    g.items.forEach((item, i) => assertDependency(item, `${field}.items[${i}]`));
}

export function assertDependency(value: unknown, field: string): void {
    assert(typeof value === "object" && value !== null, `${field}: expected an object`);
    const d = value as Record<string, unknown>;
    assert(typeof d.name === "string", `${field}.name: expected a string`);
    assert(typeof d.description === "string", `${field}.description: expected a string`);
}

// ── Main validator ────────────────────────────────────────────────────────────

export function assertCatalogItem(item: IEverMarketplaceCatalogItem): ValidationResult {
    assert(
        typeof item.id === "string" && item.id.length > 0,
        `id: expected a non-empty string`,
    );

    assertVersion(item.itemVersion, "itemVersion");

    assert(
        typeof item.name === "string" && item.name.length > 0,
        `name: expected a non-empty string`,
    );

    assertMarkdown(item.cardDescription, "cardDescription");

    assert(
        ITEM_TYPES.has(item.type),
        `type: expected one of ${[...ITEM_TYPES].join(", ")}, got ${JSON.stringify(item.type)}`,
    );

    assert(
        typeof item.categoryName === "string" && item.categoryName.length > 0,
        `categoryName: expected a non-empty string`,
    );

    assert(
        typeof item.subCategoryName === "string" && item.subCategoryName.length > 0,
        `subCategoryName: expected a non-empty string`,
    );

    assert(typeof item.benefits === "string", `benefits: expected a string`);

    assert(Array.isArray(item.primaryApps), `primaryApps: expected an array`);
    item.primaryApps.forEach((app, i) => assertAppDefinition(app, `primaryApps[${i}]`));

    assert(Array.isArray(item.apps), `apps: expected an array`);
    item.apps.forEach((app, i) => assertAppDefinition(app, `apps[${i}]`));

    assert(typeof item.installEfforts === "string", `installEfforts: expected a string`);

    assertMedia(item.heroMedia, "heroMedia");

    assertRef(item.bundle, "bundle");

    assertMarkdown(item.fullDescription, "fullDescription");

    assert(Array.isArray(item.tags), `tags: expected an array`);
    item.tags.forEach((tag, i) => {
        assert(typeof tag === "string", `tags[${i}]: expected a string`);
    });

    if (item.techSpecsUrl !== undefined) {
        assertUrl(item.techSpecsUrl, "techSpecsUrl");
    }

    assert(Array.isArray(item.dependencies), `dependencies: expected an array`);
    item.dependencies.forEach((dep, i) => assertDependencyGroup(dep, `dependencies[${i}]`));

    assert(typeof item.textIndex === "string", `textIndex: expected a string`);

    assert(
        item.visibility === undefined || typeof item.visibility === "string",
        `visibility: expected a string or undefined, got ${JSON.stringify(item.visibility)}`,
    );

    const warnings: ValidationWarning[] = [
        ...spellCheckText(item.name, "name"),
        ...(typeof item.cardDescription === "string" ? spellCheckText(item.cardDescription, "cardDescription") : []),
        ...(typeof item.fullDescription === "string" ? spellCheckText(item.fullDescription, "fullDescription") : []),
        ...spellCheckText(item.benefits, "benefits"),
        ...spellCheckText(item.installEfforts, "installEfforts"),
    ];
    return { warnings };
}

function assertMarkdownHref(
    value: IEverMarketplaceMarkdown,
    field: string,
    attachments: CatalogItemResult["attachments"],
): void {
    if (typeof value === "string") {
        assert(
            value.length <= MARKDOWN_EXTRACTION_CUTOFF,
            `${field}: inline content length ${value.length} exceeds cutoff ${MARKDOWN_EXTRACTION_CUTOFF}; should be a href ref`,
        );
        return;
    }
    const filename = value.href.split("/").at(-1)!;
    assert(
        Object.prototype.hasOwnProperty.call(attachments, filename),
        `${field}: attachment "${filename}" (from href "${value.href}") is not present in attachments`,
    );
}

export function assertCatalogItemResult(result: Omit<CatalogItemResult, "warnings">): ValidationResult {
    const { warnings } = assertCatalogItem(result.item);
    assertMarkdownHref(result.item.cardDescription, "cardDescription", result.attachments);
    assertMarkdownHref(result.item.fullDescription, "fullDescription", result.attachments);
    return { warnings };
}
