import React, { useState } from 'react';
import type {
  IEverMarketplaceCatalogItem,
  IEverMarketplaceSetupComponent,
} from '../model/catalog';
import { resolveMarkdown } from './catalog-data';
import { ItemIcon, IntegrationPill } from './CatalogCard';

interface Props {
  item: IEverMarketplaceCatalogItem;
  onBack: () => void;
  showDevPanel: boolean;
}

function MarkdownBlock({ content }: { content: string }) {
  // Very simple markdown renderer: headings, bold, lists, paragraphs
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={key++} className="md-list">
          {listBuffer.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={key++} className="md-h3">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={key++} className="md-h2">{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={key++} className="md-h1">{line.slice(2)}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      // Handle inline bold (**text**)
      const parts = line.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <p key={key++} className="md-p">
          {parts.map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
          )}
        </p>
      );
    }
  }
  flushList();

  return <div className="markdown-body">{elements}</div>;
}

function SetupSection({
  label,
  items,
}: {
  label: string;
  items: readonly IEverMarketplaceSetupComponent[];
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="setup-section">
      <button
        className="setup-section-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="setup-section-label">
          {label} ({items.length})
        </span>
        <span className="setup-section-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="setup-section-list">
          {items.map((item) => (
            <li key={item.name} className="setup-section-item">
              <span className="setup-item-name">{item.name}</span>
              <span className="setup-item-desc">{item.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── JSON syntax highlighter ──────────────────────────────────────────────────

const TOKEN_RE =
  /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],])/g;

function JsonHighlight({ json }: { json: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(json)) !== null) {
    if (match.index > last) parts.push(json.slice(last, match.index));
    const tok = match[0];
    let cls = 'jt-punct';
    if (tok.startsWith('"')) {
      cls = match[2] ? 'jt-key' : 'jt-string';
    } else if (tok === 'true' || tok === 'false') {
      cls = 'jt-bool';
    } else if (tok === 'null') {
      cls = 'jt-null';
    } else if (/^-?\d/.test(tok)) {
      cls = 'jt-number';
    }
    parts.push(<span key={match.index} className={cls}>{tok}</span>);
    last = TOKEN_RE.lastIndex;
  }
  if (last < json.length) parts.push(json.slice(last));

  return <code className="json-highlighted">{parts}</code>;
}

// ── Dev panel ────────────────────────────────────────────────────────────────

function DevPanel({ item }: { item: IEverMarketplaceCatalogItem }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(item, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const panelContent = (
    <>
      <div className="dev-panel-header">
        <span className="dev-panel-title">Raw JSON</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" onClick={() => setExpanded(true)} title="Expand">
            ⤢
          </button>
          <button className="btn btn-secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="dev-panel-json">
        <JsonHighlight json={json} />
      </pre>
    </>
  );

  return (
    <>
      <div className="dev-panel">{panelContent}</div>

      {expanded && (
        <div className="modal-overlay" onClick={() => setExpanded(false)}>
          <div className="dev-panel-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dev-panel-header">
              <span className="dev-panel-title">{item.name} — Raw JSON</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="btn btn-secondary" onClick={() => setExpanded(false)}>
                  ✕
                </button>
              </div>
            </div>
            <pre className="dev-panel-json dev-panel-json-expanded">
              <JsonHighlight json={json} />
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main detail component ─────────────────────────────────────────────────────

export default function CatalogDetail({ item, onBack, showDevPanel }: Props) {
  const { setupOverview } = item;

  const dependencyCount =
    setupOverview.connectors.length +
    setupOverview.memories.length +
    setupOverview.collections.length;
  const workflowCount = setupOverview.workflows.length;

  const howItWorksText = resolveMarkdown(item.howItWorks);
  const overviewText = resolveMarkdown(item.overview);

  return (
    <div className="detail-page">
      <div className="detail-back-bar">
        <button className="back-btn" onClick={onBack}>
          &larr; Back to catalog
        </button>
      </div>

      <div className="detail-layout">
        {/* ── Left main panel ─────────────────────────────────── */}
        <div className="detail-main">
          {/* Hero image — random but deterministic per item */}
          <div className="hero-image-wrap">
            <img
              className="hero-image"
              src={`https://picsum.photos/seed/${encodeURIComponent(item.id)}/1200/400`}
              alt={item.name}
            />
            {item.heroMedia.kind === 'video' && (
              <span className="hero-play-badge">&#9654; Video preview</span>
            )}
          </div>

          {/* Overview */}
          <section className="detail-section">
            <h2 className="detail-section-title">Overview</h2>
            <MarkdownBlock content={overviewText} />
          </section>

          {/* How it works */}
          <section className="detail-section">
            <h2 className="detail-section-title">How It Works</h2>
            <MarkdownBlock content={howItWorksText} />
          </section>

          {/* Setup Overview */}
          <section className="detail-section">
            <h2 className="detail-section-title">
              Setup Overview
              <span className="detail-section-meta">
                {setupOverview.setupTime}
              </span>
            </h2>
            <SetupSection
              label="Connectors"
              items={setupOverview.connectors}
            />
            <SetupSection label="Memories" items={setupOverview.memories} />
            <SetupSection
              label="Collections"
              items={setupOverview.collections}
            />
            <SetupSection label="Workflows" items={setupOverview.workflows} />
          </section>
        </div>

        {/* ── Right sidebar ───────────────────────────────────── */}
        <aside className="detail-sidebar">
          <div className="sidebar-icon-row">
            <ItemIcon name={item.name} size={56} />
            <div className="sidebar-name-block">
              <h2 className="sidebar-name">{item.name}</h2>
              <span className="badge type-badge">{item.type}</span>
            </div>
          </div>

          <div className="sidebar-categories">
            {item.categories.join(' \u2022 ')}
          </div>

          {item.keyBenefit && (
            <div className="key-benefit sidebar-key-benefit">
              <span className="key-benefit-gem">&#128142;</span>{' '}
              {item.keyBenefit}
            </div>
          )}

          {/* Stats row */}
          <div className="sidebar-stats">
            <div className="stat-chip">
              <span className="stat-icon">&#9203;</span>
              <span className="stat-label">{setupOverview.setupTime}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-icon">&#128203;</span>
              <span className="stat-label">{dependencyCount} dependencies</span>
            </div>
            <div className="stat-chip">
              <span className="stat-icon">&#8617;</span>
              <span className="stat-label">{workflowCount} workflows</span>
            </div>
          </div>

          {/* Required apps */}
          {item.integrations.length > 0 && (
            <div className="sidebar-integrations">
              <h3 className="sidebar-section-title">Required apps</h3>
              <div className="integration-pills">
                {item.integrations.map((intg) => (
                  <IntegrationPill key={intg.name} name={intg.name} />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="sidebar-actions">
            <button className="setup-btn">
              Set Up {item.type}
            </button>
            {item.supportUrl && (
              <a
                href={item.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="support-link"
              >
                Get Support
              </a>
            )}
            {item.techSpecsUrl && (
              <a
                href="#"
                className="techspecs-link"
                onClick={(e) => e.preventDefault()}
                title={item.techSpecsUrl}
              >
                &#8595; Download Tech Specs
              </a>
            )}
          </div>
        </aside>

        {/* ── Dev Panel drawer ─────────────────────────────────── */}
        {showDevPanel && <DevPanel item={item} />}
      </div>
    </div>
  );
}
