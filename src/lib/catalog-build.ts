import {
    EverMarketplaceItemDependencyType,
    IEverMarketplaceAppDefinition,
    IEverMarketplaceAppId,
    IEverMarketplaceCatalogItem,
    IEverMarketplaceItemType,
    IEverMarketplaceMarkdown,
    IEverMarketplaceMedia,
    IEverMarketplaceRef,
    IEverMarketplaceUrl,
    IEverMarketplaceVersion,
} from "../model/catalog";
import { AppRegistry, defaultAppRegistry } from "./app-registry";
import { assertCatalogItemResult } from "./catalog-validate";
import * as clickup from "./clickup-utils";
import type { ClickUpTaskSummary } from "./clickup-utils";
import { markdownToPdf } from "./markdown-to-pdf";

export const MARKDOWN_EXTRACTION_CUTOFF = 200;

type AttachmentFilePath = string;
type AttachmentFileContent = Buffer;

export type CatalogItemResult = {
    item: IEverMarketplaceCatalogItem;
    attachments: Record<AttachmentFilePath, AttachmentFileContent>;
};


function parseVersion(dateUpdated: string): IEverMarketplaceVersion {
    const date = new Date(parseInt(dateUpdated, 10));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}.${month}.${day}-0` as IEverMarketplaceVersion;
}

/**
 * Extracts the content under a top-level `# HEADING` in a markdown string.
 * Returns an empty string if the heading is not found.
 */
function extractMarkdownSection(markdown: string, heading: string): string {
    const headingPattern = new RegExp(`^# ${heading}$`, "m");
    const startMatch = headingPattern.exec(markdown);
    if (!startMatch) return "";
    const remaining = markdown.slice(startMatch.index + startMatch[0].length);
    const nextHeadingMatch = /^# /m.exec(remaining);
    return (nextHeadingMatch ? remaining.slice(0, nextHeadingMatch.index) : remaining).trim();
}

type ResolvedMarkdown = {
    markdown: IEverMarketplaceMarkdown;
    /** Present when the content exceeded the cutoff and must be stored as a file. */
    attachments: Record<AttachmentFilePath, AttachmentFileContent>
};

/**
 * Returns the markdown value inline if it fits within MARKDOWN_EXTRACTION_CUTOFF;
 * otherwise returns a href ref plus the attachment entry to be stored by the caller.
 */
function resolveMarkdown(content: string, id: string, filename: string): ResolvedMarkdown {
    if (content.length <= MARKDOWN_EXTRACTION_CUTOFF) {
        return { markdown: content, attachments: {} };
    }
    const href = `ew-marketplace://${id}/${filename}.md` as IEverMarketplaceUrl;
    return { markdown: { href }, attachments: { [`${filename}.md`]: Buffer.from(content, "utf-8") } };
}

function parseDependencyLines(
    text: string,
    type: EverMarketplaceItemDependencyType,
): Array<{ type: EverMarketplaceItemDependencyType; name: string; description: string }> {
    // Strip zero-width and formatting Unicode characters that ClickUp inserts
    return text
        .split("\n")
        .map(line => line.replace(/[\u200B-\u200D\uFEFF]/g, "").trim())
        .filter(line => line.length > 0)
        .map(line => {
            const sep = line.indexOf(" - ");
            if (sep === -1) return { type, name: line, description: "" };
            return {
                type,
                name: line.slice(0, sep).trim(),
                description: line.slice(sep + 3).trim(),
            };
        });
}

function labelsToApps(labelNames: string[], registry: AppRegistry): IEverMarketplaceAppDefinition[] {
    return labelNames
        .map(name => registry[name as IEverMarketplaceAppId])
        .filter((app): app is IEverMarketplaceAppDefinition => app !== undefined);
}

type BuildCatalogItemOptions = {
    appRegistry?: AppRegistry;
};

export function buildCatalogItem(
    summary: ClickUpTaskSummary,
    { appRegistry = defaultAppRegistry }: BuildCatalogItemOptions = {},
): CatalogItemResult {
    const id = summary.custom_id;
    const attachments: Record<AttachmentFilePath, AttachmentFileContent> = {};

    // ── Version ──────────────────────────────────────────────────────────────
    const itemVersion = parseVersion(summary.date_updated);

    // ── Markdown sections ────────────────────────────────────────────────────
    const shortDescContent = extractMarkdownSection(summary.markdown_description, "SHORT-DESC");
    const fullDescContent = extractMarkdownSection(summary.markdown_description, "FULL-DESC");

    const { markdown: cardDescription, attachments: cardDescAttachments } = resolveMarkdown(shortDescContent, id, "card-description");
    Object.assign(attachments, cardDescAttachments);

    const { markdown: fullDescription, attachments: fullDescAttachments } = resolveMarkdown(fullDescContent, id, "full-description");
    Object.assign(attachments, fullDescAttachments);

    // ── Dropdown fields ──────────────────────────────────────────────────────
    const rawType = clickup.getDropDownValue(clickup.getField(summary, "ITEM_TYPE") ?? { id: "", name: "ITEM_TYPE", type: "drop_down", type_config: {}, required: null });
    const type: IEverMarketplaceItemType =
        rawType === "Worker" || rawType === "Workflow" ? rawType : "Worker";

    const categoryField = clickup.getField(summary, "ITEM_CATEGORY");
    const categoryName = (categoryField ? clickup.getDropDownValue(categoryField) : undefined) ?? "";

    const subCategoryField = clickup.getField(summary, "ITEM_SUB_CATEGORY");
    const subCategoryName = (subCategoryField ? clickup.getDropDownValue(subCategoryField) : undefined) ?? "";

    // ── Short-text fields ────────────────────────────────────────────────────
    const benefits = ((clickup.getField(summary, "ITEM_BENEFITS")?.value) as string | undefined) ??
        ((clickup.getField(summary, "ITEM_INCENTIVES")?.value) as string | undefined) ??
        "";
    const installEfforts = ((clickup.getField(summary, "ITEM_INSTALL_EFFORTS")?.value) as string | undefined) ?? "";

    // ── App labels ───────────────────────────────────────────────────────────
    const primaryAppsField = clickup.getField(summary, "ITEM_PRIMARY_APPS");
    const primaryApps = labelsToApps(primaryAppsField ? clickup.getLabelNames(primaryAppsField) : [], appRegistry);

    const appsField = clickup.getField(summary, "ITEM_APPS");
    const apps = labelsToApps(appsField ? clickup.getLabelNames(appsField) : [], appRegistry);

    // ── Hero media ───────────────────────────────────────────────────────────
    const heroUrlRaw = (clickup.getField(summary, "ITEM_HERO_MEDIA_URL")?.value) as string | undefined;
    const heroFileRaw = ((clickup.getField(summary, "ITEM_HERO_MEDIA_FILE")?.value) as { url?: string } | undefined)?.url;
    const heroMedia: IEverMarketplaceMedia = {
        kind: "image",
        url: ((heroUrlRaw ?? heroFileRaw) ?? `ew-marketplace://${id}/hero-media`) as IEverMarketplaceUrl,
    };

    // ── Bundle ref ───────────────────────────────────────────────────────────
    const bundleFileUrl = ((clickup.getField(summary, "ITEM_BUNDLE_JSON")?.value) as { url?: string } | undefined)?.url;
    const bundle: IEverMarketplaceRef = {
        href: (bundleFileUrl ?? `ew-marketplace://${id}/bundle.json`) as IEverMarketplaceUrl,
    };

    // ── Tech specs ───────────────────────────────────────────────────────────
    const techSpecsFileUrl = ((clickup.getField(summary, "ITEM_TECH_SPECS_FILE")?.value) as { url?: string } | undefined)?.url;
    let techSpecsUrl: IEverMarketplaceUrl | undefined;
    if (techSpecsFileUrl) {
        techSpecsUrl = techSpecsFileUrl as IEverMarketplaceUrl;
    } else {
        const techSpecsContent = extractMarkdownSection(summary.markdown_description, "TECH-SPECS");
        if (techSpecsContent) {
            const href = `ew-marketplace://${id}/tech-specs.pdf` as IEverMarketplaceUrl;
            attachments["tech-specs.pdf"] = markdownToPdf(techSpecsContent);
            techSpecsUrl = href;
        }
    }

    // ── Visibility ───────────────────────────────────────────────────────────
    const visibilityField = clickup.getField(summary, "ITEM_PUBLISHING_VISIBILITY");
    const visibility = visibilityField ? clickup.getDropDownValue(visibilityField) : undefined;

    // ── Tags ─────────────────────────────────────────────────────────────────
    const tags = summary.tags.map(t => t.name);

    // ── Dependencies ─────────────────────────────────────────────────────────
    const dep = (fieldName: string) =>
        ((clickup.getField(summary, fieldName)?.value) as string | undefined) ?? "";

    const dependencies = [
        ...parseDependencyLines(dep("ITEM_DEP_CONNECTORS"), "connector"),
        ...parseDependencyLines(dep("ITEM_DEP_MEMORIES"), "memory"),
        ...parseDependencyLines(dep("ITEM_DEP_COLLECTIONS"), "collection"),
        ...parseDependencyLines(dep("ITEM_DEP_WORKFLOWS"), "workflow"),
    ];

    // ── Text index ───────────────────────────────────────────────────────────
    const textIndex = [
        summary.name,
        shortDescContent,
        fullDescContent,
        benefits,
        installEfforts,
        categoryName,
        subCategoryName,
        ...apps.map(a => a.name),
        ...dependencies.map(d => `${d.name} ${d.description}`),
    ].filter(Boolean).join(" ").toLowerCase();

    const item: IEverMarketplaceCatalogItem = {
        id,
        itemVersion,
        name: summary.name,
        cardDescription,
        type,
        categoryName,
        subCategoryName,
        benefits,
        primaryApps,
        apps,
        installEfforts,
        heroMedia,
        bundle,
        fullDescription,
        tags,
        techSpecsUrl,
        dependencies,
        visibility,
        textIndex,
    };

    const result: CatalogItemResult = { item, attachments };

    return result;
}
