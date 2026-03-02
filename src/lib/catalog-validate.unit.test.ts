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
        incentives: "Saves time",
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
        assert.throws(() => assertAppDefinition({ ...valid, appId: "Slack" as never }, "f"));
    });

    it("rejects an empty name", () => {
        assert.throws(() => assertAppDefinition({ ...valid, name: "" }, "f"));
    });
});

// ── assertDependency ──────────────────────────────────────────────────────────

describe("assertDependency", () => {
    it("accepts all valid dependency types", () => {
        for (const type of ["connector", "memory", "collection", "workflow"]) {
            assertDependency({ type, name: "Foo", description: "Bar" }, "f");
        }
    });

    it("rejects an unknown type", () => {
        assert.throws(() => assertDependency({ type: "plugin", name: "x", description: "y" }, "f"));
    });

    it("rejects a non-string name", () => {
        assert.throws(() => assertDependency({ type: "connector", name: 42, description: "y" }, "f"));
    });
});

// ── assertCatalogItem ─────────────────────────────────────────────────────────

describe("assertCatalogItem", () => {
    it("accepts a fully valid item", () => {
        assertCatalogItem(makeItem());
    });

    it("rejects an empty id", () => {
        assert.throws(() => assertCatalogItem(makeItem({ id: "" })));
    });

    it("rejects an invalid itemVersion", () => {
        assert.throws(() => assertCatalogItem(makeItem({ itemVersion: "1.0" as never })));
    });

    it("rejects an unknown type", () => {
        assert.throws(() => assertCatalogItem(makeItem({ type: "Skill" as never })));
    });

    it("rejects an empty categoryName", () => {
        assert.throws(() => assertCatalogItem(makeItem({ categoryName: "" })));
    });

    it("validates techSpecsUrl when present", () => {
        assertCatalogItem(makeItem({ techSpecsUrl: "ew-marketplace://id/tech.pdf" }));
        assert.throws(() => assertCatalogItem(makeItem({ techSpecsUrl: "bad" as never })));
    });
});

// ── assertCatalogItemResult — cutoff checks ───────────────────────────────────

describe("assertCatalogItemResult (cutoff)", () => {
    it("accepts an inline cardDescription at exactly the cutoff", () => {
        assertCatalogItemResult(makeResult({ item: makeItem({ cardDescription: AT_CUTOFF }) }));
    });

    it("rejects an inline cardDescription that exceeds the cutoff", () => {
        assert.throws(
            () => assertCatalogItemResult(makeResult({ item: makeItem({ cardDescription: LONG }) })),
            /cardDescription.*exceeds cutoff/,
        );
    });

    it("accepts a ref cardDescription whose attachment length exceeds the cutoff", () => {
        assertCatalogItemResult({
            item: makeItem({ cardDescription: { href: HREF } }),
            attachments: { [HREF]: Buffer.from(LONG, "utf-8") },
        });
    });

    it("rejects a ref cardDescription with no matching attachment", () => {
        assert.throws(
            () => assertCatalogItemResult({
                item: makeItem({ cardDescription: { href: HREF } }),
                attachments: {},
            }),
            /cardDescription.*not present in attachments/,
        );
    });

    it("applies the same cutoff rules to fullDescription", () => {
        const fullHref = "ew-marketplace://MW-0001/full-description.md" as const;

        // inline too long → reject
        assert.throws(() => assertCatalogItemResult(makeResult({
            item: makeItem({ fullDescription: LONG }),
        })));

        // ref with long attachment → accept
        assertCatalogItemResult({
            item: makeItem({ fullDescription: { href: fullHref } }),
            attachments: { [fullHref]: Buffer.from(LONG, "utf-8") },
        });
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
                const filePath = path.join(CATALOG_DIR, href.replace(/^ew-marketplace:\/\//, ""));
                attachments[href] = fs.readFileSync(filePath);
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
