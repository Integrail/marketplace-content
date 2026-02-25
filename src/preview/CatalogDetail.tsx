import React, { useState, useEffect } from 'react';
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

// ── Setup wizard dialog ───────────────────────────────────────────────────────

type WizardStep = 'intro' | 'installing' | 'complete';

function SetupWizardDialog({
  item,
  onClose,
}: {
  item: IEverMarketplaceCatalogItem;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [installingIdx, setInstallingIdx] = useState(0);

  const agents = item.agentOrchestration ??
    item.setupOverview.workflows.map((w) => `${w.name} Agent`);

  const progress = agents.length > 0
    ? Math.min(100, Math.round((installingIdx / agents.length) * 100))
    : 100;

  useEffect(() => {
    if (step !== 'installing') return;
    if (agents.length === 0) { setStep('complete'); return; }

    const interval = setInterval(() => {
      setInstallingIdx((prev) => {
        const next = prev + 1;
        if (next >= agents.length) {
          clearInterval(interval);
          setTimeout(() => setStep('complete'), 600);
        }
        return next;
      });
    }, 380);
    return () => clearInterval(interval);
  }, [step]);

  const connectorCount = item.setupOverview.connectors.length;
  const agentCount = agents.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal wizard-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Intro step ───────────────────────────────── */}
        {step === 'intro' && (
          <>
            <div className="modal-header">
              <h2>&#9881; Set Up {item.type}</h2>
              <button className="modal-close" onClick={onClose}>&#215;</button>
            </div>
            <div className="wizard-item-row">
              <ItemIcon name={item.name} size={40} />
              <div>
                <div className="wizard-item-name">{item.name}</div>
                <div className="wizard-item-desc">{item.categories.join(' \u2022 ')}</div>
              </div>
            </div>
            <p className="wizard-body-text">
              This will configure <strong>{agentCount}</strong> agents and connect{' '}
              <strong>{connectorCount}</strong> integration{connectorCount !== 1 ? 's' : ''}
              {' '}to your workspace.
            </p>
            <div className="wizard-checklist">
              {agents.slice(0, 5).map((a) => (
                <div key={a} className="wizard-check-row">
                  <span className="wizard-check-icon wizard-check-pending">&#9711;</span>
                  <span>{a}</span>
                </div>
              ))}
              {agents.length > 5 && (
                <div className="wizard-check-row wizard-check-more">
                  + {agents.length - 5} more agents
                </div>
              )}
            </div>
            <div className="wizard-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => { setInstallingIdx(0); setStep('installing'); }}
              >
                Start Setup
              </button>
            </div>
          </>
        )}

        {/* ── Installing step ──────────────────────────── */}
        {step === 'installing' && (
          <>
            <div className="modal-header">
              <h2>&#128260; Installing&hellip;</h2>
            </div>
            <div className="wizard-progress-wrap">
              <div className="wizard-progress-bar">
                <div
                  className="wizard-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="wizard-progress-pct">{progress}%</span>
            </div>
            <div className="wizard-checklist">
              {agents.map((a, i) => (
                <div key={a} className="wizard-check-row">
                  <span
                    className={`wizard-check-icon ${
                      i < installingIdx
                        ? 'wizard-check-done'
                        : i === installingIdx
                        ? 'wizard-check-active'
                        : 'wizard-check-pending'
                    }`}
                  >
                    {i < installingIdx ? '&#10003;' : i === installingIdx ? '&#8635;' : '&#9711;'}
                  </span>
                  <span style={{ color: i < installingIdx ? '#16a34a' : i === installingIdx ? '#111' : '#9ca3af' }}>
                    {a}
                  </span>
                </div>
              ))}
            </div>
            <p className="wizard-status-text">
              {installingIdx < agents.length
                ? `Configuring ${agents[installingIdx]}…`
                : 'Finalizing…'}
            </p>
          </>
        )}

        {/* ── Complete step ────────────────────────────── */}
        {step === 'complete' && (
          <>
            <div className="modal-header">
              <h2>&#10003; Setup Complete</h2>
              <button className="modal-close" onClick={onClose}>&#215;</button>
            </div>
            <div className="wizard-success-icon">&#10003;</div>
            <p className="wizard-body-text" style={{ textAlign: 'center' }}>
              <strong>{item.name}</strong> is ready to use.
            </p>
            <div className="wizard-stats-row">
              <div className="wizard-stat">
                <span className="wizard-stat-num">{agentCount}</span>
                <span className="wizard-stat-label">Agents configured</span>
              </div>
              <div className="wizard-stat">
                <span className="wizard-stat-num">{connectorCount}</span>
                <span className="wizard-stat-label">Connectors ready</span>
              </div>
              <div className="wizard-stat">
                <span className="wizard-stat-num">&#10003;</span>
                <span className="wizard-stat-label">Fully operational</span>
              </div>
            </div>
            <div className="wizard-actions">
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={onClose}>
                &#9654; Run {item.type}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tech details dialog ───────────────────────────────────────────────────────

const TECH_DETAILS = [
  { label: 'Platform', value: 'Integrail Multi-Agent Platform v2.0' },
  { label: 'Agent Protocol', value: 'Multi-Agent Orchestration (MAO)' },
  { label: 'Runtime', value: 'Node.js v22, ESM' },
  { label: 'Supported Models', value: 'Claude 3.5 Sonnet, GPT-4 Turbo, Gemini 1.5 Pro' },
  { label: 'Max Context', value: '200K tokens per agent' },
  { label: 'Memory Storage', value: 'Vector DB + Structured JSON KV' },
  { label: 'Connector Auth', value: 'OAuth 2.0, API Keys, Webhooks' },
  { label: 'Output Formats', value: 'JSON, Markdown, PDF, Email, Webhook' },
  { label: 'Concurrency', value: 'Up to 8 parallel sub-agents' },
  { label: 'Retry Policy', value: '3× exponential backoff' },
  { label: 'Audit Logging', value: 'Full request/response trail' },
  { label: 'Data Residency', value: 'EU or US (tenant-configurable)' },
  { label: 'API Version', value: '1.0.0' },
  { label: 'SLA', value: '99.9% uptime (Enterprise tier)' },
];

function TechDetailsDialog({ item, onClose }: { item: IEverMarketplaceCatalogItem; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tech-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>&#128196; Tech Details</h2>
          <button className="modal-close" onClick={onClose}>&#215;</button>
        </div>
        <p className="modal-hint">
          Technical specification for <strong>{item.name}</strong>
        </p>
        <table className="tech-table">
          <tbody>
            {TECH_DETAILS.map(({ label, value }) => (
              <tr key={label}>
                <td className="tech-table-label">{label}</td>
                <td className="tech-table-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="wizard-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <a
            href="#"
            className="btn btn-primary"
            onClick={(e) => e.preventDefault()}
          >
            &#8595; Download PDF Spec
          </a>
        </div>
      </div>
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
  const [showWizard, setShowWizard] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

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
            <button className="setup-btn" onClick={() => setShowWizard(true)}>
              &#9881; Set Up {item.type}
            </button>
            <button
              className="support-link"
              onClick={() => setShowTechDetails(true)}
            >
              &#128196; Tech Details
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
          </div>
        </aside>

        {/* ── Dev Panel drawer ─────────────────────────────────── */}
        {showDevPanel && <DevPanel item={item} />}
      </div>

      {showWizard && (
        <SetupWizardDialog item={item} onClose={() => setShowWizard(false)} />
      )}
      {showTechDetails && (
        <TechDetailsDialog item={item} onClose={() => setShowTechDetails(false)} />
      )}
    </div>
  );
}
