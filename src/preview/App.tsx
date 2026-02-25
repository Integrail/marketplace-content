import React, { useState, useMemo } from 'react';
import type { IEverMarketplaceCatalogItem } from '../model/catalog';
import { catalogItems } from './catalog-data';
import CatalogCard from './CatalogCard';
import CatalogDetail from './CatalogDetail';

function matchesSearch(item: IEverMarketplaceCatalogItem, query: string): boolean {
  const q = query.toLowerCase();
  const desc = typeof item.description === 'string' ? item.description : '';
  return (
    item.name.toLowerCase().includes(q) ||
    desc.toLowerCase().includes(q) ||
    item.categories.some((c) => c.toLowerCase().includes(q)) ||
    item.tags.some((t) => t.toLowerCase().includes(q)) ||
    item.integrations.some((i) => i.name.toLowerCase().includes(q))
  );
}

export default function App() {
  const [selectedItem, setSelectedItem] =
    useState<IEverMarketplaceCatalogItem | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return catalogItems;
    return catalogItems.filter((item) => matchesSearch(item, q));
  }, [searchQuery]);

  const countLabel =
    searchQuery.trim()
      ? `${filteredItems.length} of ${catalogItems.length} items`
      : `${catalogItems.length} items`;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">EverWorker Marketplace <span className="app-title-sub">Structure preview</span></h1>
          <span className="item-count-badge">{countLabel}</span>
        </div>
        {!selectedItem && (
          <div className="app-header-center">
            <input
              className="search-input"
              type="search"
              placeholder="Search by name, category, integration…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search catalog"
            />
          </div>
        )}
        <div className="app-header-right">
          <button
            className={`btn ${showDevPanel ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => setShowDevPanel((v) => !v)}
          >
            Dev Panel
          </button>
        </div>
      </header>

      <div className="demo-banner" role="note">
        ⚠️ <strong>Demo only</strong> — this is a preview of marketplace
        content structure, not the actual look and feel of a real implementation.
      </div>

      {selectedItem ? (
        <CatalogDetail
          item={selectedItem}
          onBack={() => setSelectedItem(null)}
          showDevPanel={showDevPanel}
        />
      ) : (
        <>
          {filteredItems.length > 0 ? (
            <main className="catalog-grid">
              {filteredItems.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedItem(item)}
                  searchQuery={searchQuery.trim()}
                />
              ))}
            </main>
          ) : (
            <div className="search-empty">
              <div className="search-empty-icon">🔍</div>
              <p className="search-empty-text">
                No items match <strong>"{searchQuery}"</strong>
              </p>
              <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
