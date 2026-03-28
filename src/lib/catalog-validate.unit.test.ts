import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARKDOWN_EXTRACTION_CUTOFF, CatalogItemResult } from "./catalog-build.js";
import {
    assertUrl,
    assertVersion,
    assertMarkdown,
    assertRef,
    assertMedia,
    assertAppDefinition,
    assertDependency,
    assertDependencyGroup,
    assertCatalogItem,
    assertCatalogItemResult,
} from "./catalog-validate.js";
import type { IEverMarketplaceCatalogItem } from "../model/catalog.js";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SHORT = "Short description.";                       // length well below cutoff
const LONG  = "x".repeat(MARKDOWN_EXTRACTION_CUTOFF + 1); // length above cutoff
const AT_CUTOFF = "x".repeat(MARKDOWN_EXTRACTION_CUTOFF); // length exactly at cutoff

const HREF = "ew-marketplace://MW-0001/card-description.md" as const;

function makeItem(overrides: Partial<IEverMarketplaceCatalogItem> = {}): IEverMarketplaceCatalogItem {
    return {
        id: "MW-0001",
        itemVersion: "2026.3.1-0",
        name: "Test Item",
        cardDescription: SHORT,
        type: "Worker",
        categoryName: "Finance",
        subCategoryName: "Accounting & Reporting",
        benefits: "Saves time",
        primaryApps: [],
        apps: [],
        installEfforts: "30 mins",
        heroMedia: { kind: "image", url: "ew-marketplace://MW-0001/hero-media" },
        bundle: { href: "ew-marketplace://MW-0001/bundle.json" },
        fullDescription: SHORT,
        tags: [],
        dependencies: [],
        textIndex: "test item",
        ...overrides,
    };
}

function makeResult(overrides: Partial<CatalogItemResult> = {}): CatalogItemResult {
    return { item: makeItem(), attachments: {}, ...overrides };
}

// ── assertUrl ─────────────────────────────────────────────────────────────────

describe("assertUrl", () => {
    it("accepts ew-marketplace:// URLs", () => {
        assertUrl("ew-marketplace://apps/gmail/logo", "f");
    });

    it("accepts https:// URLs", () => {
        assertUrl("https://example.com/path", "f");
    });

    it("accepts http:// URLs", () => {
        assertUrl("http://example.com/path", "f");
    });

    it("rejects a URL with no path after the host", () => {
        assert.throws(() => assertUrl("https://example.com", "f"));
    });

    it("rejects a non-string value", () => {
        assert.throws(() => assertUrl(42, "f"));
    });
});

// ── assertVersion ─────────────────────────────────────────────────────────────

describe("assertVersion", () => {
    it("accepts a valid version string", () => {
        assertVersion("2026.3.1-0", "v");
    });

    it("rejects a version missing the build segment", () => {
        assert.throws(() => assertVersion("2026.3.1", "v"));
    });

    it("rejects a non-numeric segment", () => {
        assert.throws(() => assertVersion("2026.3.x-0", "v"));
    });
});

// ── assertMarkdown ────────────────────────────────────────────────────────────

describe("assertMarkdown", () => {
    it("accepts a non-empty inline string", () => {
        assertMarkdown("some content", "f");
    });

    it("rejects an empty inline string", () => {
        assert.throws(() => assertMarkdown("", "f"));
    });

    it("accepts a { href } ref with a valid URL", () => {
        assertMarkdown({ href: "ew-marketplace://id/file.md" }, "f");
    });

    it("rejects a { href } ref with an invalid URL", () => {
        assert.throws(() => assertMarkdown({ href: "not-a-url" }, "f"));
    });

    it("rejects a plain object without href", () => {
        assert.throws(() => assertMarkdown({ text: "hi" }, "f"));
    });
});

// ── assertRef ─────────────────────────────────────────────────────────────────

describe("assertRef", () => {
    it("accepts a valid href", () => {
        assertRef({ href: "ew-marketplace://id/bundle.json" }, "f");
    });

    it("rejects an invalid href", () => {
        assert.throws(() => assertRef({ href: "nope" as never }, "f"));
    });
});

// ── assertMedia ───────────────────────────────────────────────────────────────

describe("assertMedia", () => {
    it("accepts a valid image", () => {
        assertMedia({ kind: "image", url: "ew-marketplace://id/hero" }, "f");
    });

    it("accepts a valid video with thumbnailUrl", () => {
        assertMedia({
            kind: "video",
            url: "https://example.com/video.mp4",
            thumbnailUrl: "https://example.com/thumb.jpg",
        }, "f");
    });

    it("rejects a video without thumbnailUrl", () => {
        assert.throws(() => assertMedia({ kind: "video", url: "https://example.com/v.mp4" }, "f"));
    });

    it("rejects an unknown kind", () => {
        assert.throws(() => assertMedia({ kind: "gif" as never, url: "ew-marketplace://id/f" }, "f"));
    });

    it("rejects an invalid url", () => {
        assert.throws(() => assertMedia({ kind: "image", url: "bad" as never }, "f"));
    });
});

// ── assertAppDefinition ───────────────────────────────────────────────────────

describe("assertAppDefinition", () => {
    const valid = {
        appId: "GMail" as const,
        name: "GMail",
        logoUrl: "ew-marketplace://apps/gmail/logo" as const,
        description: "ew-marketplace://apps/gmail/description" as const,
    };

    it("accepts a valid app definition", () => {
        assertAppDefinition(valid, "f");
    });

    it("rejects an unknown appId", () => {
        assert.throws(() => assertAppDefinition({ ...valid, appId: "NonExistentApp12345" as never }, "f"));
    });

    it("rejects an empty name", () => {
        assert.throws(() => assertAppDefinition({ ...valid, name: "" }, "f"));
    });
});

// ── assertDependency ──────────────────────────────────────────────────────────

describe("assertDependency", () => {
    it("accepts a valid dependency item", () => {
        assertDependency({ name: "Foo", description: "Bar" }, "f");
    });

    it("rejects a non-string name", () => {
        assert.throws(() => assertDependency({ name: 42, description: "y" }, "f"));
    });

    it("rejects a non-string description", () => {
        assert.throws(() => assertDependency({ name: "x", description: 99 }, "f"));
    });
});

describe("assertDependencyGroup", () => {
    it("accepts all valid dependency types", () => {
        for (const type of ["connector", "memory", "collection", "workflow", "mcp", "code_node", "worker"]) {
            assertDependencyGroup({ type, title: "T", summary: "S", items: [] }, "f");
        }
    });

    it("rejects an unknown type", () => {
        assert.throws(() => assertDependencyGroup({ type: "plugin", title: "T", summary: "S", items: [] }, "f"));
    });
});

// ── assertCatalogItem — collects errors, does not throw ───────────────────────

describe("assertCatalogItem", () => {
    it("accepts a fully valid item (no errors)", () => {
        const { errors } = assertCatalogItem(makeItem());
        assert.equal(errors.length, 0);
    });

    it("reports an error for empty id", () => {
        const { errors } = assertCatalogItem(makeItem({ id: "" }));
        assert.ok(errors.some(e => e.field === "id"), `expected error for 'id', got: ${JSON.stringify(errors)}`);
    });

    it("reports an error for invalid itemVersion", () => {
        const { errors } = assertCatalogItem(makeItem({ itemVersion: "1.0" as never }));
        assert.ok(errors.some(e => e.field === "itemVersion"), `expected error for 'itemVersion', got: ${JSON.stringify(errors)}`);
    });

    it("reports an error for unknown type", () => {
        const { errors } = assertCatalogItem(makeItem({ type: "Skill" as never }));
        assert.ok(errors.some(e => e.field === "type"), `expected error for 'type', got: ${JSON.stringify(errors)}`);
    });

    it("reports an error for empty categoryName", () => {
        const { errors } = assertCatalogItem(makeItem({ categoryName: "" }));
        assert.ok(errors.some(e => e.field === "categoryName"), `expected error for 'categoryName', got: ${JSON.stringify(errors)}`);
    });

    it("reports an error for empty subCategoryName", () => {
        const { errors } = assertCatalogItem(makeItem({ subCategoryName: "" }));
        assert.ok(errors.some(e => e.field === "subCategoryName"), `expected error for 'subCategoryName', got: ${JSON.stringify(errors)}`);
    });

    it("reports an error for empty cardDescription", () => {
        const { errors } = assertCatalogItem(makeItem({ cardDescription: "" }));
        assert.ok(errors.some(e => e.field === "cardDescription"), `expected error for 'cardDescription', got: ${JSON.stringify(errors)}`);
    });

    it("collects multiple errors in one pass", () => {
        const { errors } = assertCatalogItem(makeItem({ id: "", categoryName: "", subCategoryName: "" }));
        assert.ok(errors.length >= 3, `expected at least 3 errors, got ${errors.length}: ${JSON.stringify(errors)}`);
    });

    it("validates techSpecsUrl when present (valid)", () => {
        const { errors } = assertCatalogItem(makeItem({ techSpecsUrl: "ew-marketplace://id/tech.pdf" }));
        assert.equal(errors.length, 0);
    });

    it("reports an error for invalid techSpecsUrl", () => {
        const { errors } = assertCatalogItem(makeItem({ techSpecsUrl: "bad" as never }));
        assert.ok(errors.some(e => e.field === "techSpecsUrl"), `expected error for 'techSpecsUrl', got: ${JSON.stringify(errors)}`);
    });

    it("accepts a string visibility", () => {
        const { errors } = assertCatalogItem(makeItem({ visibility: "TEMPLATE" }));
        assert.equal(errors.length, 0);
    });

    it("accepts undefined visibility", () => {
        const { errors } = assertCatalogItem(makeItem({ visibility: undefined }));
        assert.equal(errors.length, 0);
    });

    it("reports an error for non-string visibility", () => {
        const { errors } = assertCatalogItem(makeItem({ visibility: 42 as never }));
        assert.ok(errors.some(e => e.field === "visibility"), `expected error for 'visibility', got: ${JSON.stringify(errors)}`);
    });
});

// ── assertCatalogItemResult — cutoff checks ───────────────────────────────────

describe("assertCatalogItemResult (cutoff)", () => {
    it("accepts an inline cardDescription at exactly the cutoff (no errors)", () => {
        const { errors } = assertCatalogItemResult(makeResult({ item: makeItem({ cardDescription: AT_CUTOFF }) }));
        assert.equal(errors.length, 0);
    });

    it("reports an error for inline cardDescription exceeding the cutoff", () => {
        const { errors } = assertCatalogItemResult(makeResult({ item: makeItem({ cardDescription: LONG }) }));
        assert.ok(
            errors.some(e => /cardDescription/.test(e.field) && /exceeds cutoff/.test(e.message)),
            `expected cutoff error for cardDescription, got: ${JSON.stringify(errors)}`,
        );
    });

    it("accepts a ref cardDescription whose attachment length exceeds the cutoff (no errors)", () => {
        const { errors } = assertCatalogItemResult({
            item: makeItem({ cardDescription: { href: HREF } }),
            attachments: { "card-description.md": Buffer.from(LONG, "utf-8") },
        });
        assert.equal(errors.length, 0);
    });

    it("reports an error for a ref cardDescription with no matching attachment", () => {
        const { errors } = assertCatalogItemResult({
            item: makeItem({ cardDescription: { href: HREF } }),
            attachments: {},
        });
        assert.ok(
            errors.some(e => /cardDescription/.test(e.field) && /not present in attachments/.test(e.message)),
            `expected attachment error, got: ${JSON.stringify(errors)}`,
        );
    });

    it("applies the same cutoff rules to fullDescription", () => {
        const fullHref = "ew-marketplace://MW-0001/full-description.md" as const;

        // inline too long → error
        const { errors: e1 } = assertCatalogItemResult(makeResult({ item: makeItem({ fullDescription: LONG }) }));
        assert.ok(errors => true, 'type check'); // TypeScript happy
        assert.ok(e1.some(e => /fullDescription/.test(e.field)));

        // ref with long attachment → no error
        const { errors: e2 } = assertCatalogItemResult({
            item: makeItem({ fullDescription: { href: fullHref } }),
            attachments: { "full-description.md": Buffer.from(LONG, "utf-8") },
        });
        assert.equal(e2.length, 0);
    });
});

// ── catalog items on disk ─────────────────────────────────────────────────────

describe("catalog items on disk", () => {
    const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const CATALOG_DIR = path.join(ROOT, "catalog");

    function loadCatalogItemResult(id: string): CatalogItemResult {
        const item = JSON.parse(
            fs.readFileSync(path.join(CATALOG_DIR, id, "index.json"), "utf-8"),
        ) as IEverMarketplaceCatalogItem;

        const attachments: Record<string, Buffer> = {};
        for (const value of [item.cardDescription, item.fullDescription]) {
            if (typeof value === "object" && value !== null && "href" in value) {
                const href = (value as { href: string }).href;
                const filename = href.split("/").at(-1)!;
                attachments[filename] = fs.readFileSync(path.join(CATALOG_DIR, id, filename));
            }
        }

        return { item, attachments };
    }

    const catalogIds = fs.existsSync(CATALOG_DIR)
        ? fs.readdirSync(CATALOG_DIR).filter(d => /^MW-\d+$/.test(d)).sort()
        : [];

    for (const id of catalogIds) {
        it(`loads ${id} without error`, () => {
            assert.doesNotThrow(() => loadCatalogItemResult(id));
        });
    }
});
