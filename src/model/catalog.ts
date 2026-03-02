
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
 * Used for connectors, memories, collections, and workflows.
 */
export interface IEverMarketplaceSetupComponent {
    readonly name: IEverMarketplacePlainText;
    readonly description: IEverMarketplacePlainText;
}

export interface IEverMarketplaceSetupOverview {
    readonly setupTime: string;
    readonly connectors: readonly IEverMarketplaceSetupComponent[];
    readonly memories: readonly IEverMarketplaceSetupComponent[];
    readonly collections: readonly IEverMarketplaceSetupComponent[];
    readonly workflows: readonly IEverMarketplaceSetupComponent[];
}

export interface IEverMarketplaceAuthor {
    readonly name: IEverMarketplacePlainText;
    readonly avatarUrl: IEverMarketplaceUrl;
}

export interface IEverMarketplaceIntegration {
    readonly name: IEverMarketplacePlainText;
    readonly logoUrl: IEverMarketplaceUrl;
}

export interface IEverMarketplaceKeyResult {
    readonly metric: string;
    readonly value: string;
}

export interface IEverMarketplaceCatalogItem {
    readonly id: string;
    readonly name: IEverMarketplacePlainText;
    /**
     * Short summary shown on the card and at the top of the detail sidebar.
     */
    readonly description: IEverMarketplaceMarkdown;
    readonly itemVersion: IEverMarketplaceVersion;
    readonly type: IEverMarketplaceItemType;
    readonly categories: readonly IEverMarketplaceCategoryName[];
    readonly tags: readonly IEverMarketplaceTag[];
    readonly iconUrl: IEverMarketplaceUrl;
    readonly author: IEverMarketplaceAuthor;
    readonly keyBenefit?: string;
    readonly integrations: readonly IEverMarketplaceIntegration[];
    readonly heroMedia: IEverMarketplaceMedia;
    /**
     * Full description shown on the item detail page.
     */
    readonly overview: IEverMarketplaceMarkdown;
    readonly howItWorks: IEverMarketplaceRef;
    readonly setupOverview: IEverMarketplaceSetupOverview;
    readonly supportUrl: IEverMarketplaceUrl;
    readonly techSpecsUrl?: IEverMarketplaceUrl;
    readonly keyResults?: readonly IEverMarketplaceKeyResult[];
    readonly outputs?: readonly string[];
    readonly triggers?: readonly string[];
    readonly knowledgeSources?: readonly string[];
    readonly agentOrchestration?: readonly string[];
}

export interface IEverMarketplaceCatalog {
    readonly catalogVersion: IEverMarketplaceVersion;
    readonly items: readonly IEverMarketplaceCatalogItem[];
}
