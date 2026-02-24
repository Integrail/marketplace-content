import React, { useState } from 'react';
import type { IEverMarketplaceCatalogItem } from '../model/catalog';
import { catalogItems } from './catalog-data';
import CatalogCard from './CatalogCard';
import CatalogDetail from './CatalogDetail';

export default function App() {
  const [selectedItem, setSelectedItem] =
    useState<IEverMarketplaceCatalogItem | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">EverWorker Marketplace <span className="app-title-sub">Structure preview</span></h1>
          <span className="item-count-badge">{catalogItems.length} items</span>
        </div>
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
        <main className="catalog-grid">
          {catalogItems.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </main>
      )}
    </div>
  );
}
