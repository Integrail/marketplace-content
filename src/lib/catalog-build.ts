import {
    EverMarketplaceItemDependencyType,
    IEverMarketplaceAppDefinition,
    IEverMarketplaceAppId,
    IEverMarketplaceCatalogItem,
    IEverMarketplaceItemDependency,
    IEverMarketplaceItemDependencyGroup,
    IEverMarketplaceItemType,
    IEverMarketplaceMarkdown,
    IEverMarketplaceMedia,
    IEverMarketplaceRef,
    IEverMarketplaceUrl,
    IEverMarketplaceVersion,
} from "../model/catalog";
import { AppRegistry, defaultAppRegistry } from "./app-registry";
import * as clickup from "./clickup-utils";
import type { ClickUpTaskSummary } from "./clickup-utils";
import { markdownToPdf } from "./markdown-to-pdf";

export const MARKDOWN_EXTRACTION_CUTOFF = 5000;

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

const DEPENDENCY_TITLES: Record<EverMarketplaceItemDependencyType, string> = {
    connector:  "Connectors",
    memory:     "Memories",
    collection: "Collections",
    workflow:   "Workflows",
    mcp:   "MCP Servers",
    code_node:   "Custom Nodes",
};

function parseDependencyGroup(
    type: EverMarketplaceItemDependencyType,
    summaryText: string | undefined,
    itemsText: string,
): IEverMarketplaceItemDependencyGroup {
    const items = parseDependencyItems(itemsText);
    if (summaryText == null || summaryText.trim() === "") {
        const count = itemsText.split("\n").filter(line => line.trim() !== "").length;
        summaryText = String(count);
    }
    return {
        type,
        title: DEPENDENCY_TITLES[type],
        summary: summaryText,
        items,
    };
}

function parseDependencyItems(
    text: string,
): IEverMarketplaceItemDependency[] {
    // Strip zero-width and formatting Unicode characters that ClickUp inserts
    return text
        .split("\n")
        .map(line => line.replace(/[\u200B-\u200D\uFEFF]/g, "").trim())
        .filter(line => line.length > 0)
        .map(line => {
            // Prefer " - " separator (e.g. "QuickBooks - Accounting access")
            const dashSep = line.indexOf(" - ");
            if (dashSep !== -1) {
                return {
                    name: line.slice(0, dashSep).trim(),
                    description: line.slice(dashSep + 3).trim(),
                };
            }
            // Fall back to ": " separator (e.g. "OneDrive: The finalized checklist...")
            const colonSep = line.indexOf(": ");
            if (colonSep !== -1) {
                return {
                    name: line.slice(0, colonSep).trim(),
                    description: line.slice(colonSep + 2).trim(),
                };
            }
            return { name: line, description: "" };
        });
}

function labelsToApps(labelNames: string[], registry: AppRegistry): IEverMarketplaceAppDefinition[] {
    return labelNames
        .map(name => registry[name as IEverMarketplaceAppId])
        .filter((app): app is IEverMarketplaceAppDefinition => app !== undefined);
}

type BuildCatalogItemOptions = {
    appRegistry?: AppRegistry;
    /** Local attachment files keyed by filename, loaded from the task's attachments/ directory. */
    localAttachments?: Record<string, Buffer>;
    /** Absolute path to the attachments directory (used as basedir for image resolution in PDF). */
    attachmentsDir?: string;
};

export async function buildCatalogItem(
    summary: ClickUpTaskSummary,
    { appRegistry = defaultAppRegistry, localAttachments, attachmentsDir }: BuildCatalogItemOptions = {},
): Promise<CatalogItemResult> {
    const id = summary.custom_id;
    const attachments: Record<AttachmentFilePath, AttachmentFileContent> = {};

    // ── Version ──────────────────────────────────────────────────────────────
    const itemVersion = parseVersion(summary.date_updated);

    // ── Markdown sections ────────────────────────────────────────────────────
    const shortDescContent = extractMarkdownSection(summary.markdown_description, "SHORT-DESC");
    const fullDescContent = extractMarkdownSection(summary.markdown_description, "FULL-DESC");
    const setupStartHow = extractMarkdownSection(summary.markdown_description, "SETUP-START-HOWITWORKS");

    const { markdown: cardDescription, attachments: cardDescAttachments } = resolveMarkdown(shortDescContent, id, "card-description");
    Object.assign(attachments, cardDescAttachments);

    const { markdown: fullDescription, attachments: fullDescAttachments } = resolveMarkdown(fullDescContent, id, "full-description");
    Object.assign(attachments, fullDescAttachments);

    const { markdown: setupStartHowDescription, attachments: setupStartHowAttachments } = resolveMarkdown(setupStartHow, id, "setup-start-howitworks");
    Object.assign(attachments, setupStartHowAttachments); // TODO is it need ?

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
    const heroFileFieldValue = clickup.getField(summary, "ITEM_HERO_MEDIA_FILE")?.value;
    const heroFileAttachment = Array.isArray(heroFileFieldValue)
        ? (heroFileFieldValue as Array<{ url?: string; title?: string; extension?: string }>)[0]
        : undefined;
    let heroMedia: IEverMarketplaceMedia;
    if (heroFileAttachment) {
        const ext = heroFileAttachment.extension ?? "png";
        const heroFilename = `hero-media.${ext}`;
        const localHeroContent = heroFileAttachment.title ? localAttachments?.[heroFileAttachment.title] : undefined;
        if (localHeroContent) {
            attachments[heroFilename] = localHeroContent;
            heroMedia = { kind: "image", url: `ew-marketplace://${id}/${heroFilename}` as IEverMarketplaceUrl };
        } else {
            heroMedia = { kind: "image", url: (heroFileAttachment.url ?? "ew-marketplace://defaults/default-item-hero.png") as IEverMarketplaceUrl };
        }
    } else if (heroUrlRaw) {
        heroMedia = { kind: "image", url: heroUrlRaw as IEverMarketplaceUrl };
    } else {
        heroMedia = { kind: "image", url: "ew-marketplace://defaults/default-item-hero.png" as IEverMarketplaceUrl };
    }

    // ── Bundle ref ───────────────────────────────────────────────────────────
    const bundleFieldValue = clickup.getField(summary, "ITEM_BUNDLE_JSON")?.value;
    const bundleAttachmentList = Array.isArray(bundleFieldValue)
        ? bundleFieldValue as Array<{ title?: string; url?: string }>
        : [];
    const bundleAttachment = bundleAttachmentList[0];
    const localBundleContent = bundleAttachment?.title ? localAttachments?.[bundleAttachment.title] : undefined;
    let bundle: IEverMarketplaceRef;
    if (localBundleContent) {
        attachments["bundle.json"] = localBundleContent;
        bundle = { href: `ew-marketplace://${id}/bundle.json` as IEverMarketplaceUrl };
    } else {
        bundle = { href: (bundleAttachment?.url ?? `ew-marketplace://${id}/bundle.json`) as IEverMarketplaceUrl };
    }

    // ── Tech specs ───────────────────────────────────────────────────────────
    const techSpecsFileUrl = ((clickup.getField(summary, "ITEM_TECH_SPECS_FILE")?.value) as { url?: string } | undefined)?.url;
    let techSpecsUrl: IEverMarketplaceUrl | undefined;
    if (techSpecsFileUrl) {
        techSpecsUrl = techSpecsFileUrl as IEverMarketplaceUrl;
    } else {
        const techSpecsContent = extractMarkdownSection(summary.markdown_description, "TECH-SPECS");
        if (techSpecsContent) {
            try {
                const href = `ew-marketplace://${id}/tech-specs.pdf` as IEverMarketplaceUrl;
                attachments["tech-specs.pdf"] = await markdownToPdf(techSpecsContent, attachmentsDir);
                techSpecsUrl = href;
            } catch {
                // pandoc not available — skip tech specs PDF
            }
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
        parseDependencyGroup("connector", dep("ITEM_DEP_CONNECTORS_SUMMARY"), dep("ITEM_DEP_CONNECTORS")),
        parseDependencyGroup("memory", dep("ITEM_DEP_MEMORIES_SUMMARY"), dep("ITEM_DEP_MEMORIES")),
        parseDependencyGroup("collection", dep("ITEM_DEP_COLLECTIONS_SUMMARY"), dep("ITEM_DEP_COLLECTIONS")),
        parseDependencyGroup("workflow", dep("ITEM_DEP_WORKFLOWS_SUMMARY"), dep("ITEM_DEP_WORKFLOWS")),
        parseDependencyGroup("mcp", dep("ITEM_DEP_MCP_SUMMARY"), dep("ITEM_DEP_MCP")),
        parseDependencyGroup("code_node", dep("ITEM_DEP_CUSTOMNODE_SUMMARY"), dep("ITEM_DEP_CUSTOMNODE")),
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
        ...dependencies.flatMap(g => g.items.map(d => `${d.name} ${d.description}`)),
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
        setupStartHowDescription
    };

    const result: CatalogItemResult = { item, attachments };

    return result;
}
