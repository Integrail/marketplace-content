#!/usr/bin/env node
/**
 * Generates catalog/MW-XXXX/index.json (and how-it-works.md) for every ClickUp task
 * that has an extracted PDF attachment (.MD file).
 *
 * Usage:
 *   npx tsx src/cli/generate-catalog.ts
 *   npx tsx src/cli/generate-catalog.ts --dry-run
 *   npx tsx src/cli/generate-catalog.ts --ids MW-1001,MW-1005
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TASKS_DIR = path.join(ROOT, 'click-up/tasks');
const CATALOG_DIR = path.join(ROOT, 'catalog');

const DRY_RUN = process.argv.includes('--dry-run');
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='));
const FILTER_IDS = IDS_ARG ? IDS_ARG.replace('--ids=', '').split(',') : null;

// ── department tag → category ────────────────────────────────────────────────

const TAG_TO_CATEGORY: Record<string, string> = {
    'finance and accounting': 'Finance',
    'portfolio management': 'Finance',
    'candidate processing': 'HR',
    'talent acquisition': 'Talent Acquisition',
    'talent sourcing': 'Talent Acquisition',
    'hiring execution': 'HR',
    'onboarding & hr ops': 'HR',
    'retention & development hr': 'HR',
    'customer success': 'Customer Success',
    'customer support': 'Customer Support',
    'cx management': 'Customer Success',
    'client service': 'Sales',
    'client acquisition': 'Sales',
    'demand generation': 'Marketing',
    'revenue acceleration': 'Sales',
    'brand awareness': 'Marketing',
};

const SKIP_TAGS = new Set([
    'ready for development',
    'clarification needed',
    'connector needed',
    'example needed',
]);

// ── types ─────────────────────────────────────────────────────────────────────

interface KeyResult {
    metric: string;
    value: string;
}

interface ParsedBlueprint {
    triggers: string[];
    knowledgeSources: string[];
    agentOrchestration: string[];
    integrationNames: string[];
    outputs: string[];
}

interface ParsedMD {
    name: string;
    shortDescription: string;
    longDescription: string;
    keyResults: KeyResult[];
    blueprint: ParsedBlueprint;
}

interface SummaryJson {
    name: string;
    text_content: string;
    tags: Array<{ name: string }>;
    attachments: Array<{ title: string; extension: string }>;
}

// ── MD parser ─────────────────────────────────────────────────────────────────

function parseMDFile(content: string): ParsedMD {
    const lines = content.split('\n');

    // Find section boundaries
    const blueprintIdx = lines.findIndex(l => l.trim() === 'Blueprint');
    const keyResultsHeaderIdx = lines.findIndex(l => l.trim() === 'Key Results');

    const headerLines = blueprintIdx >= 0 ? lines.slice(0, blueprintIdx) : lines;
    const blueprintLines = blueprintIdx >= 0 ? lines.slice(blueprintIdx + 1) : [];

    // Detect two-column (A) vs single-column (B) layout
    const isFormatA = /\s{10,}Key Results/.test(lines[0] ?? '');

    let name = '';
    let shortDescription = '';
    const keyResults: KeyResult[] = [];

    if (isFormatA) {
        // ── Format A: two-column PDF layout ──────────────────────────────────
        name = lines[0].replace(/\s{10,}Key Results.*$/, '').trim();
        shortDescription = lines[1]?.trim() || '';

        // Key results live in the right column. Each line (whether or not it also
        // has left-column content) ends with the right-column text after a large gap.
        // Strategy: match the LAST large whitespace gap (10+ spaces) in the line;
        // everything after it is right-column content.
        let currentKR: KeyResult | null = null;
        for (const line of headerLines) {
            const rightMatch = line.match(/\s{10,}(\S.+)$/);
            if (!rightMatch) continue;
            const rightContent = rightMatch[1].trim();
            if (!rightContent || rightContent === 'Key Results') continue;

            // New metric+value pair: "MetricName       Value"
            const newKR = rightContent.match(/^([A-Z][a-zA-Z\s\/()]+?)\s{3,}(\S.+)$/);
            if (newKR) {
                if (currentKR) keyResults.push(currentKR);
                currentKR = { metric: newKR[1].trim(), value: cleanText(newKR[2].trim()) };
            } else if (currentKR) {
                // Value continuation
                currentKR.value += ' ' + cleanText(rightContent);
            }
        }
        if (currentKR) keyResults.push(currentKR);
    } else {
        // ── Format B: single-column PDF layout ───────────────────────────────
        name = lines[0].trim();
        shortDescription = lines[1]?.trim() || '';

        const krStart = keyResultsHeaderIdx >= 0 ? keyResultsHeaderIdx + 1 : -1;
        const krEnd = blueprintIdx >= 0 ? blueprintIdx : lines.length;
        if (krStart >= 0) {
            let currentKR: KeyResult | null = null;
            for (let i = krStart; i < krEnd; i++) {
                const line = lines[i];
                // "  MetricName          Value"
                const m = line.match(/^\s{2,}(\S.+?)\s{6,}(\S.+)$/);
                if (m) {
                    if (currentKR) keyResults.push(currentKR);
                    currentKR = { metric: m[1].trim(), value: cleanText(m[2].trim()) };
                } else if (currentKR) {
                    const cont = line.match(/^\s{6,}(\S.+)$/);
                    if (cont) currentKR.value += ' ' + cleanText(cont[1].trim());
                }
            }
            if (currentKR) keyResults.push(currentKR);
        }
    }

    // Extract long description from left column (Format A) or header lines (Format B)
    const longDescription = extractDescription(headerLines, isFormatA, keyResultsHeaderIdx);

    const blueprint = parseBlueprint(blueprintLines);

    return { name, shortDescription, longDescription, keyResults, blueprint };
}

function extractDescription(headerLines: string[], isFormatA: boolean, keyResultsHeaderIdx: number): string {
    if (isFormatA) {
        // Left column: lines that start at column 0 (no excessive leading whitespace)
        const parts: string[] = [];
        for (const line of headerLines.slice(1)) {
            const trimmed = line.trimEnd();
            if (!trimmed || /^\s{40,}/.test(trimmed)) continue;
            // Strip right-column content (if any)
            const leftOnly = trimmed.replace(/\s{10,}\S.*$/, '').trim();
            if (leftOnly) parts.push(leftOnly);
        }
        return parts.join(' ').replace(/4/g, '—').trim();
    } else {
        // Single column: everything between shortDescription and Key Results / Blueprint
        const end = keyResultsHeaderIdx >= 0 ? keyResultsHeaderIdx : headerLines.length;
        return headerLines
            .slice(2, end)
            .map(l => l.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/4/g, '—')
            .trim();
    }
}

function parseBlueprint(lines: string[]): ParsedBlueprint {
    type FieldKey = 'triggers' | 'knowledgeSources' | 'agentOrchestration' | 'integrations' | 'output';

    const FIELDS: [FieldKey, string][] = [
        ['triggers', 'User Input/Triggers'],
        ['knowledgeSources', 'Knowledge Sources'],
        ['agentOrchestration', 'Agent Orchestration'],
        ['integrations', 'Integrations'],
        ['output', 'Output'],
    ];

    const rawValues: Record<FieldKey, string> = {
        triggers: '',
        knowledgeSources: '',
        agentOrchestration: '',
        integrations: '',
        output: '',
    };

    let currentField: FieldKey | null = null;

    for (const line of lines) {
        let matched = false;
        for (const [key, label] of FIELDS) {
            // Field label followed by 3+ spaces and content
            const escapedLabel = label.replace(/\//g, '\\/');
            const re = new RegExp(`^\\s{2,}${escapedLabel}\\s{3,}(.+)$`);
            const m = line.match(re);
            if (m) {
                currentField = key;
                rawValues[key] = m[1].trim();
                matched = true;
                break;
            }
        }
        if (!matched && currentField) {
            // Continuation line
            const cont = line.match(/^\s{20,}(\S.+)$/);
            if (cont) rawValues[currentField] += ' ' + cont[1].trim();
        }
    }

    return {
        triggers: splitComma(rawValues.triggers),
        knowledgeSources: splitComma(rawValues.knowledgeSources),
        agentOrchestration: splitAgents(rawValues.agentOrchestration),
        integrationNames: splitComma(rawValues.integrations),
        outputs: splitComma(rawValues.output),
    };
}

/**
 * Replace PDF encoding artifacts with proper Unicode characters.
 * "4" is used as em-dash ONLY between letters (e.g. "source4email" → "source—email").
 * Numeric "4"s (like "94%", "$2.40") are NOT touched.
 */
function cleanText(s: string): string {
    return s
        .replace(/(?<=[a-zA-Z])4(?=[a-zA-Z])/g, '—')
        .replace(/³/g, '→')
        .trim();
}

/**
 * Split a comma-separated list while respecting commas inside parentheses.
 * e.g. "Invoice receipt (email, portal, scan), PO creation"
 *   → ["Invoice receipt (email, portal, scan)", "PO creation"]
 */
function splitComma(s: string): string[] {
    const clean = cleanText(s);
    let depth = 0;
    let result = '';
    for (const ch of clean) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        result += (ch === ',' && depth > 0) ? '\x00' : ch;
    }
    return result.split(',').map(v => v.trim().replace(/\x00/g, ',').trim()).filter(Boolean);
}

function splitAgents(s: string): string[] {
    // PDF encodes "→" as "³" between agent names
    const sep = s.includes('³') ? '³' : ',';
    return s.split(sep).map(v => cleanText(v).replace(/→/g, '').trim()).filter(Boolean);
}

// ── catalog item builder ───────────────────────────────────────────────────────

function buildCatalogItem(id: string, summary: SummaryJson, parsed: ParsedMD): object {
    const categories = deriveCategories(summary.tags);
    const tags = deriveTags(summary.tags);

    // Use first line of summary text_content as clean description
    const cleanDesc = summary.text_content.split('\n')[0].trim();

    const integrations = parsed.blueprint.integrationNames
        .slice(0, 6)
        .map(name => ({
            name,
            logoUrl: `ew-marketplace://logos/${slugify(name)}.png`,
        }));

    // Workflows from agent orchestration
    const workflows = parsed.blueprint.agentOrchestration.map(agentName => {
        const workflowName = agentName.replace(/\s+Agent$/, '').trim();
        return {
            name: workflowName,
            description: `Handles the ${workflowName.toLowerCase()} step`,
        };
    });

    // Connectors from first few integrations
    const connectors = parsed.blueprint.integrationNames.slice(0, 4).map(name => ({
        name,
        description: `Integration with ${name}`,
    }));

    const keyBenefit = parsed.keyResults.length > 0
        ? parsed.keyResults[0].value
        : undefined;

    const item: Record<string, unknown> = {
        id,
        name: summary.name,
        description: cleanDesc,
        itemVersion: '1.0.0-1' as const,
        type: 'Worker' as const,
        categories,
        tags,
        iconUrl: `ew-marketplace://${id}/icon.png`,
        author: {
            name: 'Integrail.ai',
            avatarUrl: 'ew-marketplace://shared/integrail-avatar.png',
        },
        ...(keyBenefit ? { keyBenefit } : {}),
        integrations,
        heroMedia: {
            kind: 'image',
            url: `ew-marketplace://${id}/hero.png`,
        },
        overview: parsed.longDescription || cleanDesc,
        howItWorks: { href: `ew-marketplace://${id}/how-it-works.md` },
        setupOverview: {
            setupTime: '30 mins',
            connectors,
            memories: [
                {
                    name: 'Business Policies',
                    description: 'Rules, thresholds, and decision criteria for this worker',
                },
            ],
            collections: [],
            workflows: workflows.length > 0 ? workflows : [
                { name: 'Main Workflow', description: 'Primary automation workflow' },
            ],
        },
        supportUrl: 'https://integrail.ai/support',
        keyResults: parsed.keyResults.length > 0 ? parsed.keyResults : undefined,
        outputs: parsed.blueprint.outputs.length > 0 ? parsed.blueprint.outputs : undefined,
        triggers: parsed.blueprint.triggers.length > 0 ? parsed.blueprint.triggers : undefined,
        knowledgeSources: parsed.blueprint.knowledgeSources.length > 0 ? parsed.blueprint.knowledgeSources : undefined,
        agentOrchestration: parsed.blueprint.agentOrchestration.length > 0 ? parsed.blueprint.agentOrchestration : undefined,
    };

    // Remove undefined values
    return JSON.parse(JSON.stringify(item));
}

function buildHowItWorksMD(summary: SummaryJson, parsed: ParsedMD): string {
    const lines: string[] = [`# How it Works: ${summary.name}`, ''];

    if (parsed.longDescription) {
        lines.push(parsed.longDescription, '');
    }

    if (parsed.blueprint.triggers.length > 0) {
        lines.push('## Triggers', '');
        parsed.blueprint.triggers.forEach(t => lines.push(`- ${t}`));
        lines.push('');
    }

    if (parsed.blueprint.agentOrchestration.length > 0) {
        lines.push('## Agent Orchestration', '');
        parsed.blueprint.agentOrchestration.forEach((a, i) =>
            lines.push(`${i + 1}. **${a}**`),
        );
        lines.push('');
    }

    if (parsed.blueprint.knowledgeSources.length > 0) {
        lines.push('## Knowledge Sources', '');
        parsed.blueprint.knowledgeSources.forEach(k => lines.push(`- ${k}`));
        lines.push('');
    }

    if (parsed.blueprint.outputs.length > 0) {
        lines.push('## Outputs', '');
        parsed.blueprint.outputs.forEach(o => lines.push(`- ${o}`));
        lines.push('');
    }

    return lines.join('\n');
}

// ── helpers ───────────────────────────────────────────────────────────────────

function deriveCategories(tags: Array<{ name: string }>): string[] {
    const cats = tags
        .filter(t => !SKIP_TAGS.has(t.name))
        .map(t => TAG_TO_CATEGORY[t.name])
        .filter((c): c is string => Boolean(c));
    return cats.length > 0 ? [...new Set(cats)] : ['General'];
}

function deriveTags(tags: Array<{ name: string }>): string[] {
    // Use non-department tags that are not skip tags
    return tags
        .filter(t => !SKIP_TAGS.has(t.name) && !TAG_TO_CATEGORY[t.name])
        .map(t => t.name)
        .filter(Boolean);
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── main ──────────────────────────────────────────────────────────────────────

function processTask(taskId: string): boolean {
    const taskDir = path.join(TASKS_DIR, taskId);
    const summaryPath = path.join(taskDir, `${taskId}-summary.json`);
    const attachmentsDir = path.join(taskDir, 'attachments');

    if (!fs.existsSync(summaryPath)) {
        console.warn(`  [skip] No summary.json for ${taskId}`);
        return false;
    }

    const summary: SummaryJson = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    // Find the .MD file
    let mdPath: string | null = null;
    if (fs.existsSync(attachmentsDir)) {
        const mdFiles = fs.readdirSync(attachmentsDir).filter(f => f.endsWith('.MD'));
        if (mdFiles.length > 0) {
            mdPath = path.join(attachmentsDir, mdFiles[0]);
        }
    }

    if (!mdPath) {
        console.warn(`  [skip] No .MD attachment for ${taskId}`);
        return false;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const parsed = parseMDFile(mdContent);

    const catalogItem = buildCatalogItem(taskId, summary, parsed);
    const howItWorksMD = buildHowItWorksMD(summary, parsed);

    const outDir = path.join(CATALOG_DIR, taskId);
    const indexPath = path.join(outDir, 'index.json');
    const howItWorksPath = path.join(outDir, 'how-it-works.md');

    if (DRY_RUN) {
        console.log(`  [dry-run] Would write: ${indexPath}`);
        console.log(`  [dry-run] Would write: ${howItWorksPath}`);
        console.log(JSON.stringify(catalogItem, null, 2).slice(0, 500) + '...');
    } else {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(indexPath, JSON.stringify(catalogItem, null, 2) + '\n');
        fs.writeFileSync(howItWorksPath, howItWorksMD);
        console.log(`  ✓ ${taskId}: ${summary.name}`);
    }

    return true;
}

function main() {
    const taskDirs = fs.readdirSync(TASKS_DIR)
        .filter(d => /^MW-\d+$/.test(d))
        .sort();

    const targets = FILTER_IDS
        ? taskDirs.filter(d => FILTER_IDS.includes(d))
        : taskDirs;

    console.log(`Processing ${targets.length} tasks${DRY_RUN ? ' (dry-run)' : ''}...\n`);

    let success = 0;
    let skipped = 0;
    for (const taskId of targets) {
        const ok = processTask(taskId);
        if (ok) success++; else skipped++;
    }

    console.log(`\nDone: ${success} generated, ${skipped} skipped.`);
}

main();
