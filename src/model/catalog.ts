
export type IEverMarketplacePlainText = string;
export type IEverMarketplaceVersion = `${number}.${number}.${number}-${number}`;
export type IEverMarketplaceUrl =
    | `ew-marketplace://${string}/${string}`
    | `http://${string}/${string}`
    | `https://${string}/${string}`;

/**
 * A reference to an external resource (e.g. a markdown file).
 * Used wherever markdown content may be too large to embed inline.
 */
export interface IEverMarketplaceRef {
    readonly href: IEverMarketplaceUrl;
}

/**
 * Markdown content — either embedded as a string or referenced externally.
 * Prefer a ref for long-form content to keep index.json lightweight.
 */
export type IEverMarketplaceMarkdown = string | IEverMarketplaceRef;

/**
 * The kind of artifact a catalog item represents.
 * Rendered as a distinct badge on the card (e.g. "Worker").
 */
export type IEverMarketplaceItemType =
    | 'Workflow'
    | 'Worker';

export type IEverMarketplaceCategoryName =
    | 'Marketing'
    | 'Finance'
    | 'Sales'
    | (string & {});

export type IEverMarketplaceSubCategoryName =
    | 'todo1'
    | 'todo2'
    | 'todo3'
    | (string & {});


export type IEverMarketplaceTag =
    | 'Delivery'
    | 'IT'
    | (string & {});

/** Hero banner shown at the top of the detail view. */
export type IEverMarketplaceMediaKind = 'image' | 'video';

export interface IEverMarketplaceMedia {
    readonly kind: IEverMarketplaceMediaKind;
    readonly url: IEverMarketplaceUrl;
    /** Required for video; used as the static preview frame. */
    readonly thumbnailUrl?: IEverMarketplaceUrl;
}

/**
 * A single named component listed inside the Setup overview section.
 * Used for Connectors, Memories, Collections, and Workflows.
 */
export interface IEverMarketplaceSetupComponent {
    readonly name: IEverMarketplacePlainText;
    readonly description: IEverMarketplacePlainText;
}

export type IEverMarketplaceAppId  = "GMail" | "NetSuite" | "QuickBooks";


/**
 * Hardcoded in tool, exposed by names from ClickUp
 */
export interface IEverMarketplaceAppDefinition {
    readonly appId: IEverMarketplaceAppId;
    readonly name: IEverMarketplacePlainText;
    readonly logoUrl: IEverMarketplaceUrl;
    readonly description: IEverMarketplaceUrl;
}

export type EverMarketplaceItemDependencyType = "connector" | "memory" | "collection" | "workflow";

interface IEverMarketplaceItemDependency {
    readonly type: EverMarketplaceItemDependencyType;
    readonly name: string;
    readonly description: string;
}

export interface IEverMarketplaceCatalogItem {
    /**
     * Custom task id in ClickUp.
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_id
     *
     */
    readonly id: string;

    /**
     * Version from parsed date
     * - ClickUp Path: MW-{XXXX}-summary.json/date_updated
     */
    readonly itemVersion: IEverMarketplaceVersion;

    /**
     * Item name
     * - ClickUp Path: MW-{XXXX}-summary.json/name
     */
    readonly name: IEverMarketplacePlainText;

    /**
     * Short summary shown on the card and at the top of the detail sidebar.
     * - ClickUp Path: MW-{XXXX}-summary.json/markdown_description[first H1: "SHORT-DESC"]
     */
    readonly cardDescription: IEverMarketplaceMarkdown;
    /**
     * ITEM_TYPE
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_TYPE"]
     */
    readonly type: IEverMarketplaceItemType;
    /**
     * ITEM_CATEGORY (enum subject)
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_SUB_CATEGORY"]
     */
    readonly categoryName: IEverMarketplaceCategoryName;

    /**
     * ITEM_SUB_CATEGORY (enum subject)
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_SUB_CATEGORY"]
     */
    readonly subCategoryName: IEverMarketplaceSubCategoryName;

    /**
     * ITEM_INCENTIVES
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_INCENTIVES"]
     */
    readonly incentives: string;

    /**
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_PRIMARY_APPS"]
     */
    readonly primaryApps: readonly IEverMarketplaceAppDefinition[];
    /**
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_APPS"]
     */
    readonly apps: readonly IEverMarketplaceAppDefinition[];

    /**
     * Install efforts
     * - ClickUp Path: MW-{XXXX}-summary.json/custom_fields[name="ITEM_INSTALL_EFFORTS"]
     */
    readonly installEfforts: string;

    /**
     * Hero banner image or video at the top of the detail view.
     * Source the ClickUp custom fields
     * - ITEM_HERO_MEDIA_URL
     * - ITEM_HERO_MEDIA_FILE
     * Or local file called ./hero-media.???
     */
    readonly heroMedia: IEverMarketplaceMedia;

    /**
     * - Custom field: ITEM_BUNDLE_JSON
     * - local bundle.json file
     */
    readonly bundle: IEverMarketplaceRef;

    /**
     * Full description to show on item page.
     * - ClickUp Path: MW-{XXXX}-summary.json/markdown_description[first H1: "ULL-DESC"]
     */
    readonly fullDescription: IEverMarketplaceMarkdown;

    /**
     * V2
     */
    readonly tags: readonly IEverMarketplaceTag[];

    /**
     * ClickUp custom field ITEM_TECH_SPECS_FILE
     * Local file tech-specs.*
     *
     * Markdown is converted to PDF during build time
     */
    readonly techSpecsUrl?: IEverMarketplaceUrl;

    readonly dependencies: readonly IEverMarketplaceItemDependency[];

    /**
     * Combined text of all text fields to make search simple in mongo
     */
    readonly textIndex: string;
}

export interface IEverMarketplaceCatalog {
    readonly catalogVersion: IEverMarketplaceVersion;
    readonly items: readonly IEverMarketplaceCatalogItem[];
}
