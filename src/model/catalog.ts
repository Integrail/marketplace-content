
export type IEverMarketplacePlainText = string;
export type IEverMarketplaceVersion = `${number}.${number}.${number}-${number}`;
export type IEverMarketplaceUrl =
    | `ew-marketplace://${string}/${string}`
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

export type IEverMarketplaceCategory =
    | 'Sales'
    | 'Efficiency'
    | (string & {});

export type IEverMarketplaceTag =
    | 'Delivery'
    | 'IT'
    | (string & {});

/**
 * The person or team who built the item.
 * Shown as a circular avatar overlaid on the item icon.
 */
export interface IEverMarketplaceAuthor {
    readonly name: IEverMarketplacePlainText;
    readonly avatarUrl: IEverMarketplaceUrl;
}

/**
 * An external tool or service this item integrates with.
 * Shown as a "Required apps" row on the detail sidebar and as logos on the card.
 */
export interface IEverMarketplaceIntegration {
    readonly name: IEverMarketplacePlainText;
    readonly logoUrl: IEverMarketplaceUrl;
}

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

/**
 * Structured breakdown shown in the "Setup overview" section of the detail view.
 * The sidebar's "N dependencies" stat is the sum of connectors + memories + collections.
 * The sidebar's "N workflows" stat is workflows.length.
 */
export interface IEverMarketplaceSetupOverview {
    /** Human-readable estimate shown in the sidebar, e.g. "30 mins". */
    readonly setupTime: IEverMarketplacePlainText;
    readonly connectors: readonly IEverMarketplaceSetupComponent[];
    readonly memories: readonly IEverMarketplaceSetupComponent[];
    readonly collections: readonly IEverMarketplaceSetupComponent[];
    readonly workflows: readonly IEverMarketplaceSetupComponent[];
}

export interface IEverMarketplaceCatalogItem {
    readonly id: string;
    readonly name: IEverMarketplacePlainText;
    /** Short summary shown on the card and at the top of the detail sidebar. */
    readonly description: IEverMarketplaceMarkdown;
    readonly itemVersion: IEverMarketplaceVersion;
    readonly type: IEverMarketplaceItemType;
    /**
     * Ordered category breadcrumb, e.g. ["Finance", "Accounting & Reporting"].
     * Rendered joined by " • " on both the card and the detail sidebar.
     */
    readonly categories: readonly IEverMarketplaceCategory[];
    readonly tags: readonly IEverMarketplaceTag[];
    readonly iconUrl: IEverMarketplaceUrl;
    readonly author: IEverMarketplaceAuthor;
    /** Gem-icon highlight line, e.g. "Saves ~15 hrs/week per accountant". */
    readonly keyBenefit?: IEverMarketplacePlainText;
    /** Listed as "Required apps" in the detail sidebar. */
    readonly integrations: readonly IEverMarketplaceIntegration[];

    // ── detail view ─────────────────────────────────────────────────────────
    /** Hero banner image or video at the top of the detail view. */
    readonly heroMedia: IEverMarketplaceMedia;
    /** "Overview" section — short narrative shown below the hero. */
    readonly overview: IEverMarketplaceMarkdown;
    /** "How it works" section — long-form content with sub-headings and lists. */
    readonly howItWorks: IEverMarketplaceMarkdown;
    /** Structured dependency breakdown shown in the "Setup overview" section. */
    readonly setupOverview: IEverMarketplaceSetupOverview;
    /** "Download Tech Specs" link shown at the bottom of the detail sidebar. */
    readonly techSpecsUrl?: IEverMarketplaceUrl;
    /** "Get Support" action target. */
    readonly supportUrl?: IEverMarketplaceUrl;
}

export interface IEverMarketplaceCatalog {
    readonly catalogVersion: IEverMarketplaceVersion;
    readonly items: readonly IEverMarketplaceCatalogItem[];
}
