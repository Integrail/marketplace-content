import type {
  IEverMarketplaceCatalogItem,
  IEverMarketplaceMarkdown,
  IEverMarketplaceRef,
} from '../model/catalog';

// Eagerly load all catalog JSON files
const jsonModules = import.meta.glob('../../catalog/*/index.json', {
  eager: true,
}) as Record<string, { default: IEverMarketplaceCatalogItem }>;

// Eagerly load all markdown files as raw strings
const markdownModules = import.meta.glob('../../catalog/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * All catalog items, sorted by name for stable display order.
 */
export const catalogItems: IEverMarketplaceCatalogItem[] = Object.values(
  jsonModules
).map((mod) => mod.default);

/**
 * Resolve an IEverMarketplaceMarkdown value to a plain string.
 *
 * - If it is already a string, return it as-is.
 * - If it is an IEverMarketplaceRef with an ew-marketplace:// href, map to the
 *   catalog glob key (e.g. "ew-marketplace://item1/how-it-works.md" becomes
 *   "../../catalog/item1/how-it-works.md") and look it up in the markdown map.
 */
export function resolveMarkdown(md: IEverMarketplaceMarkdown): string {
  if (typeof md === 'string') {
    return md;
  }

  const ref = md as IEverMarketplaceRef;
  const href = ref.href;

  if (href.startsWith('ew-marketplace://')) {
    // "ew-marketplace://item1/how-it-works.md" -> "../../catalog/item1/how-it-works.md"
    const path = href.slice('ew-marketplace://'.length);
    const globKey = `../../catalog/${path}`;
    const content = markdownModules[globKey];
    if (content !== undefined) {
      return content;
    }
    return `<!-- markdown not found: ${href} -->`;
  }

  // https:// reference — not supported in local preview
  return `<!-- external reference: ${href} -->`;
}
