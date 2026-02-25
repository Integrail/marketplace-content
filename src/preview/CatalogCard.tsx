import React from 'react';
import type { IEverMarketplaceCatalogItem } from '../model/catalog';

interface Props {
  item: IEverMarketplaceCatalogItem;
  onClick: () => void;
  searchQuery?: string;
}

/** Generates a deterministic hue from a string for icon colors */
function stringToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 360;
  }
  return h;
}

/** Wraps all occurrences of `query` in `text` with an animated highlight mark. */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(q);
    if (idx < 0) { parts.push(remaining); break; }
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <mark key={key++} className="search-highlight">
        {remaining.slice(idx, idx + q.length)}
      </mark>,
    );
    remaining = remaining.slice(idx + q.length);
  }

  return <>{parts}</>;
}

export function ItemIcon({
  name,
  size = 48,
}: {
  name: string;
  size?: number;
}) {
  const hue = stringToHue(name);
  return (
    <div
      className="item-icon"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 60%, 55%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.42,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function IntegrationPill({ name, query = '' }: { name: string; query?: string }) {
  const hue = stringToHue(name);
  return (
    <span
      className="integration-pill"
      style={{
        background: `hsl(${hue}, 55%, 92%)`,
        color: `hsl(${hue}, 55%, 30%)`,
      }}
    >
      <HighlightText text={name} query={query} />
    </span>
  );
}

export default function CatalogCard({ item, onClick, searchQuery = '' }: Props) {
  const MAX_INTEGRATIONS = 4;
  const visibleIntegrations = item.integrations.slice(0, MAX_INTEGRATIONS);
  const extraCount = item.integrations.length - MAX_INTEGRATIONS;
  const desc = typeof item.description === 'string' ? item.description : item.description.href;
  const categoriesText = item.categories.join(' \u2022 ');

  return (
    <div className="catalog-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      {/* Top row: icon + name */}
      <div className="card-top-row">
        <ItemIcon name={item.name} />
        <div className="card-name-block">
          <span className="card-name">
            <HighlightText text={item.name} query={searchQuery} />
          </span>
          <span className="card-author">{item.author.name}</span>
        </div>
      </div>

      {/* Badge row */}
      <div className="card-badge-row">
        <span className="badge type-badge">{item.type}</span>
        <span className="badge category-badge">
          <HighlightText text={categoriesText} query={searchQuery} />
        </span>
      </div>

      {/* Description */}
      <p className="card-description">
        <HighlightText text={desc} query={searchQuery} />
      </p>

      {/* Key benefit */}
      {item.keyBenefit && (
        <div className="key-benefit">
          <span className="key-benefit-gem">&#128142;</span> {item.keyBenefit}
        </div>
      )}

      {/* Integrations row */}
      {item.integrations.length > 0 && (
        <div className="card-integrations">
          {visibleIntegrations.map((intg) => (
            <IntegrationPill key={intg.name} name={intg.name} query={searchQuery} />
          ))}
          {extraCount > 0 && (
            <span className="integration-pill integration-pill-more">
              +{extraCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
