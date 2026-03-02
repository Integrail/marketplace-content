import assert from 'node:assert/strict';
import {
    cleanText,
    splitComma,
    splitAgents,
    deriveCategories,
    deriveTags,
    slugify,
    parseMDFile,
    buildCatalogItem,
    buildHowItWorksMD,
    type SummaryJson,
    type ParsedMD,
} from './catalog.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<SummaryJson> = {}): SummaryJson {
    return {
        name: 'Test Worker',
        text_content: 'First line description.\nSecond line.',
        tags: [],
        attachments: [],
        ...overrides,
    };
}

function makeParsed(overrides: Partial<ParsedMD> = {}): ParsedMD {
    return {
        name: 'Test Worker',
        shortDescription: 'Short.',
        longDescription: 'Long description.',
        keyResults: [],
        blueprint: {
            triggers: [],
            knowledgeSources: [],
            agentOrchestration: [],
            integrationNames: [],
            outputs: [],
        },
        ...overrides,
    };
}

/**
 * Build a Format B (single-column) MD string — the simpler layout where all
 * content flows top-to-bottom without a right-hand column.
 */
function formatB({
    name = 'Test Worker',
    shortDesc = 'Short description.',
    longDesc = '',
    keyResults = [] as Array<[string, string]>,
    triggers = '',
    knowledgeSources = '',
    agents = '',
    integrations = '',
    output = '',
} = {}) {
    const lines: string[] = [name, shortDesc];
    if (longDesc) lines.push(longDesc);
    if (keyResults.length) {
        lines.push('Key Results');
        for (const [metric, value] of keyResults) {
            lines.push(`  ${metric}          ${value}`);
        }
    }
    lines.push('Blueprint');
    if (triggers)         lines.push(`  User Input/Triggers          ${triggers}`);
    if (knowledgeSources) lines.push(`  Knowledge Sources            ${knowledgeSources}`);
    if (agents)           lines.push(`  Agent Orchestration          ${agents}`);
    if (integrations)     lines.push(`  Integrations                 ${integrations}`);
    if (output)           lines.push(`  Output                       ${output}`);
    return lines.join('\n');
}

/**
 * Build a Format A (two-column) MD string — name + "Key Results" header on line
 * 0 separated by 10+ spaces, with key result pairs in the right column.
 */
function formatA({
    name = 'AP Worker',
    shortDesc = 'Automates AP.',
    leftLines = [] as string[],
    keyResults = [] as Array<[string, string]>,
    triggers = '',
    integrations = '',
    output = '',
} = {}) {
    const PAD = '          '; // 10 spaces — triggers the two-column detection
    const lines: string[] = [`${name}${PAD}Key Results`, shortDesc];
    const krLines = keyResults.map(([metric, value]) => `${metric}   ${value}`);
    const maxLines = Math.max(leftLines.length, krLines.length);
    for (let i = 0; i < maxLines; i++) {
        const left  = leftLines[i] ?? '';
        const right = krLines[i]   ?? '';
        lines.push(right ? `${left}${PAD}${right}` : left);
    }
    lines.push('Blueprint');
    if (triggers)     lines.push(`  User Input/Triggers          ${triggers}`);
    if (integrations) lines.push(`  Integrations                 ${integrations}`);
    if (output)       lines.push(`  Output                       ${output}`);
    return lines.join('\n');
}

// ── cleanText ─────────────────────────────────────────────────────────────────

describe('cleanText', () => {
    it('returns empty string unchanged', () => {
        assert.equal(cleanText(''), '');
    });

    it('leaves plain text unchanged', () => {
        assert.equal(cleanText('hello world'), 'hello world');
    });

    it('replaces "4" between letters with em-dash', () => {
        assert.equal(cleanText('source4email'), 'source—email');
    });

    it('does not replace "4" in numeric contexts', () => {
        assert.equal(cleanText('94%'), '94%');
        assert.equal(cleanText('$2.40'), '$2.40');
        assert.equal(cleanText('4000'), '4000');
    });

    it('replaces "³" with right-arrow', () => {
        assert.equal(cleanText('A³B'), 'A→B');
    });

    it('handles multiple artifacts in one string', () => {
        assert.equal(cleanText('source4email³next'), 'source—email→next');
    });

    it('trims leading and trailing whitespace', () => {
        assert.equal(cleanText('  hello  '), 'hello');
    });
});

// ── splitComma ────────────────────────────────────────────────────────────────

describe('splitComma', () => {
    it('returns empty array for empty string', () => {
        assert.deepEqual(splitComma(''), []);
    });

    it('returns single-element array for string with no comma', () => {
        assert.deepEqual(splitComma('Alpha'), ['Alpha']);
    });

    it('splits on commas', () => {
        assert.deepEqual(splitComma('A, B, C'), ['A', 'B', 'C']);
    });

    it('preserves commas inside parentheses', () => {
        assert.deepEqual(
            splitComma('Invoice receipt (email, portal, scan), PO creation'),
            ['Invoice receipt (email, portal, scan)', 'PO creation'],
        );
    });

    it('handles nested parentheses', () => {
        assert.deepEqual(
            splitComma('Foo (a (x, y), b), Bar'),
            ['Foo (a (x, y), b)', 'Bar'],
        );
    });

    it('trims whitespace around each value', () => {
        assert.deepEqual(splitComma('  A  ,  B  '), ['A', 'B']);
    });

    it('filters empty entries', () => {
        assert.deepEqual(splitComma(',A,,B,'), ['A', 'B']);
    });
});

// ── splitAgents ───────────────────────────────────────────────────────────────

describe('splitAgents', () => {
    it('returns empty array for empty string', () => {
        assert.deepEqual(splitAgents(''), []);
    });

    it('splits on "³" when present', () => {
        assert.deepEqual(
            splitAgents('Intake Agent³Matching Agent³Approval Agent'),
            ['Intake Agent', 'Matching Agent', 'Approval Agent'],
        );
    });

    it('falls back to comma when no "³"', () => {
        assert.deepEqual(
            splitAgents('Intake Agent, Matching Agent'),
            ['Intake Agent', 'Matching Agent'],
        );
    });

    it('strips "→" characters that result from cleanText on the raw string', () => {
        // cleanText converts ³→→; splitAgents is used after the raw split so
        // residual → arrows that appear in values are removed.
        const result = splitAgents('Step One, Step→Two');
        assert.deepEqual(result, ['Step One', 'StepTwo']);
    });

    it('trims whitespace from each entry', () => {
        assert.deepEqual(splitAgents(' Agent A , Agent B '), ['Agent A', 'Agent B']);
    });
});

// ── deriveCategories ──────────────────────────────────────────────────────────

describe('deriveCategories', () => {
    it('returns ["General"] for empty tag list', () => {
        assert.deepEqual(deriveCategories([]), ['General']);
    });

    it('maps a known department tag to the correct category', () => {
        assert.deepEqual(deriveCategories([{ name: 'finance and accounting' }]), ['Finance']);
    });

    it('deduplicates when multiple tags map to the same category', () => {
        assert.deepEqual(
            deriveCategories([{ name: 'finance and accounting' }, { name: 'portfolio management' }]),
            ['Finance'],
        );
    });

    it('returns multiple distinct categories', () => {
        assert.deepEqual(
            deriveCategories([{ name: 'demand generation' }, { name: 'customer success' }]),
            ['Marketing', 'Customer Success'],
        );
    });

    it('filters out skip tags', () => {
        assert.deepEqual(
            deriveCategories([{ name: 'ready for development' }, { name: 'finance and accounting' }]),
            ['Finance'],
        );
    });

    it('returns ["General"] when only skip tags are present', () => {
        assert.deepEqual(deriveCategories([{ name: 'clarification needed' }]), ['General']);
    });

    it('returns ["General"] when only unknown non-skip tags are present', () => {
        assert.deepEqual(deriveCategories([{ name: 'some-custom-tag' }]), ['General']);
    });

    it('ignores unknown tags while still mapping known ones', () => {
        assert.deepEqual(
            deriveCategories([{ name: 'some-custom-tag' }, { name: 'demand generation' }]),
            ['Marketing'],
        );
    });
});

// ── deriveTags ────────────────────────────────────────────────────────────────

describe('deriveTags', () => {
    it('returns empty array for empty tag list', () => {
        assert.deepEqual(deriveTags([]), []);
    });

    it('returns non-department, non-skip tags', () => {
        assert.deepEqual(deriveTags([{ name: 'automation' }, { name: 'ai' }]), ['automation', 'ai']);
    });

    it('filters out skip tags', () => {
        assert.deepEqual(deriveTags([{ name: 'connector needed' }, { name: 'automation' }]), ['automation']);
    });

    it('filters out department tags', () => {
        assert.deepEqual(deriveTags([{ name: 'finance and accounting' }, { name: 'automation' }]), ['automation']);
    });

    it('returns empty array when all tags are skipped or department tags', () => {
        assert.deepEqual(
            deriveTags([{ name: 'demand generation' }, { name: 'ready for development' }]),
            [],
        );
    });
});

// ── slugify ───────────────────────────────────────────────────────────────────

describe('slugify', () => {
    it('lowercases the input', () => {
        assert.equal(slugify('Hello World'), 'hello-world');
    });

    it('replaces spaces with hyphens', () => {
        assert.equal(slugify('foo bar'), 'foo-bar');
    });

    it('replaces special characters with hyphens', () => {
        assert.equal(slugify('foo/bar.baz'), 'foo-bar-baz');
    });

    it('collapses consecutive non-alphanumeric chars into one hyphen', () => {
        assert.equal(slugify('foo  --  bar'), 'foo-bar');
    });

    it('strips leading and trailing hyphens', () => {
        assert.equal(slugify('/foo/'), 'foo');
    });

    it('preserves numbers', () => {
        assert.equal(slugify('SAP 4 Hana'), 'sap-4-hana');
    });

    it('leaves an already-slugified string unchanged', () => {
        assert.equal(slugify('already-slugified'), 'already-slugified');
    });
});

// ── parseMDFile — Format B (single-column) ────────────────────────────────────

describe('parseMDFile — Format B (single-column)', () => {
    it('extracts name and short description', () => {
        const result = parseMDFile(formatB({ name: 'AP Worker', shortDesc: 'Handles invoices.' }));
        assert.equal(result.name, 'AP Worker');
        assert.equal(result.shortDescription, 'Handles invoices.');
    });

    it('extracts long description between short description and Key Results', () => {
        const result = parseMDFile(formatB({ longDesc: 'A longer explanation of the worker.' }));
        assert.equal(result.longDescription, 'A longer explanation of the worker.');
    });

    it('returns empty longDescription when none is present', () => {
        const result = parseMDFile(formatB());
        assert.equal(result.longDescription, '');
    });

    it('parses key results', () => {
        const result = parseMDFile(formatB({
            keyResults: [['Time Saved', '3 hrs'], ['Error Rate', '94%']],
        }));
        assert.equal(result.keyResults.length, 2);
        assert.equal(result.keyResults[0].metric, 'Time Saved');
        assert.equal(result.keyResults[0].value, '3 hrs');
        assert.equal(result.keyResults[1].metric, 'Error Rate');
        assert.equal(result.keyResults[1].value, '94%');
    });

    it('returns empty keyResults when Key Results section is absent', () => {
        const result = parseMDFile(formatB());
        assert.deepEqual(result.keyResults, []);
    });

    it('parses blueprint triggers, splitting on commas', () => {
        const result = parseMDFile(formatB({ triggers: 'Invoice receipt, PO upload' }));
        assert.deepEqual(result.blueprint.triggers, ['Invoice receipt', 'PO upload']);
    });

    it('preserves commas inside parentheses in blueprint fields', () => {
        const result = parseMDFile(formatB({ triggers: 'Invoice (email, portal, scan), PO upload' }));
        assert.deepEqual(result.blueprint.triggers, ['Invoice (email, portal, scan)', 'PO upload']);
    });

    it('parses blueprint knowledge sources', () => {
        const result = parseMDFile(formatB({ knowledgeSources: 'PO database, Vendor contracts' }));
        assert.deepEqual(result.blueprint.knowledgeSources, ['PO database', 'Vendor contracts']);
    });

    it('parses blueprint agent orchestration via ³ separator', () => {
        const result = parseMDFile(formatB({ agents: 'Intake Agent³Matching Agent³Approval Agent' }));
        assert.deepEqual(result.blueprint.agentOrchestration, ['Intake Agent', 'Matching Agent', 'Approval Agent']);
    });

    it('parses blueprint integrations', () => {
        const result = parseMDFile(formatB({ integrations: 'NetSuite, SAP, Gmail' }));
        assert.deepEqual(result.blueprint.integrationNames, ['NetSuite', 'SAP', 'Gmail']);
    });

    it('parses blueprint outputs', () => {
        const result = parseMDFile(formatB({ output: 'Payment executed, Audit trail' }));
        assert.deepEqual(result.blueprint.outputs, ['Payment executed', 'Audit trail']);
    });

    it('replaces PDF em-dash artifact in long description', () => {
        const result = parseMDFile(formatB({ longDesc: 'source4email notifications' }));
        assert.equal(result.longDescription, 'source—email notifications');
    });
});

// ── parseMDFile — Format A (two-column) ──────────────────────────────────────

describe('parseMDFile — Format A (two-column)', () => {
    it('detects Format A and extracts name, stripping the right-column header', () => {
        const result = parseMDFile(formatA({ name: 'AP Worker' }));
        assert.equal(result.name, 'AP Worker');
    });

    it('extracts short description from line 1', () => {
        const result = parseMDFile(formatA({ shortDesc: 'Automates AP workflow.' }));
        assert.equal(result.shortDescription, 'Automates AP workflow.');
    });

    it('parses key results from the right column', () => {
        const result = parseMDFile(formatA({
            keyResults: [['Time Saved', '3 hrs'], ['Error Rate', '94%']],
        }));
        assert.equal(result.keyResults.length, 2);
        assert.equal(result.keyResults[0].metric, 'Time Saved');
        assert.equal(result.keyResults[0].value, '3 hrs');
        assert.equal(result.keyResults[1].metric, 'Error Rate');
        assert.equal(result.keyResults[1].value, '94%');
    });

    it('extracts long description from left-column lines (includes short description line)', () => {
        // extractDescription for Format A starts at headerLines[1] (the short description
        // line) and collects all left-column content, so shortDesc is prepended.
        const result = parseMDFile(formatA({
            shortDesc: 'Automates AP.',
            leftLines: ['This is the detailed description of the worker.'],
        }));
        assert.equal(result.longDescription, 'Automates AP. This is the detailed description of the worker.');
    });

    it('parses blueprint from Format A', () => {
        const result = parseMDFile(formatA({ integrations: 'SAP, Gmail', output: 'Payment' }));
        assert.deepEqual(result.blueprint.integrationNames, ['SAP', 'Gmail']);
        assert.deepEqual(result.blueprint.outputs, ['Payment']);
    });
});

// ── buildCatalogItem ──────────────────────────────────────────────────────────

describe('buildCatalogItem', () => {
    it('sets required scalar fields correctly', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal(item.id, 'MW-0001');
        assert.equal(item.name, 'Test Worker');
        assert.equal(item.itemVersion, '1.0.0-1');
        assert.equal(item.type, 'Worker');
        assert.equal(item.supportUrl, 'https://integrail.ai/support');
    });

    it('uses first line of text_content as description', () => {
        const { item } = buildCatalogItem(
            'MW-0001',
            makeSummary({ text_content: 'First line.\nSecond line.' }),
            makeParsed(),
        );
        assert.equal(item.description, 'First line.');
    });

    it('derives iconUrl from id', () => {
        const { item } = buildCatalogItem('MW-0042', makeSummary(), makeParsed());
        assert.equal(item.iconUrl, 'ew-marketplace://MW-0042/icon.png');
    });

    it('sets author to Integrail.ai with correct avatarUrl', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal(item.author.name, 'Integrail.ai');
        assert.equal(item.author.avatarUrl, 'ew-marketplace://shared/integrail-avatar.png');
    });

    it('derives heroMedia from id', () => {
        const { item } = buildCatalogItem('MW-0042', makeSummary(), makeParsed());
        assert.deepEqual(item.heroMedia, { kind: 'image', url: 'ew-marketplace://MW-0042/hero.png' });
    });

    it('derives howItWorks href from id', () => {
        const { item } = buildCatalogItem('MW-0042', makeSummary(), makeParsed());
        assert.deepEqual(item.howItWorks, { href: 'ew-marketplace://MW-0042/how-it-works.md' });
    });

    it('uses longDescription as overview', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed({ longDescription: 'Detailed overview.' }));
        assert.equal(item.overview, 'Detailed overview.');
    });

    it('falls back to cleanDesc for overview when longDescription is empty', () => {
        const { item } = buildCatalogItem(
            'MW-0001',
            makeSummary({ text_content: 'Fallback description.' }),
            makeParsed({ longDescription: '' }),
        );
        assert.equal(item.overview, 'Fallback description.');
    });

    it('sets keyBenefit from first keyResult value', () => {
        const parsed = makeParsed({ keyResults: [{ metric: 'Time Saved', value: '3 hrs' }] });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.equal(item.keyBenefit, '3 hrs');
    });

    it('omits keyBenefit when keyResults is empty', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed({ keyResults: [] }));
        assert.equal('keyBenefit' in item, false);
    });

    it('omits optional blueprint fields when the arrays are empty', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal('keyResults'       in item, false);
        assert.equal('outputs'          in item, false);
        assert.equal('triggers'         in item, false);
        assert.equal('knowledgeSources' in item, false);
        assert.equal('agentOrchestration' in item, false);
    });

    it('includes optional blueprint fields when arrays are non-empty', () => {
        const parsed = makeParsed({
            keyResults: [{ metric: 'M', value: 'V' }],
            blueprint: {
                triggers: ['Email'],
                knowledgeSources: ['DB'],
                agentOrchestration: ['Intake Agent'],
                integrationNames: ['SAP'],
                outputs: ['Report'],
            },
        });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.deepEqual(item.triggers,           ['Email']);
        assert.deepEqual(item.knowledgeSources,   ['DB']);
        assert.deepEqual(item.agentOrchestration, ['Intake Agent']);
        assert.deepEqual(item.outputs,            ['Report']);
        assert.deepEqual(item.keyResults,         [{ metric: 'M', value: 'V' }]);
    });

    it('caps integrations at 6', () => {
        const parsed = makeParsed({
            blueprint: { ...makeParsed().blueprint, integrationNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.equal(item.integrations.length, 6);
    });

    it('builds integration logoUrl via slugified name', () => {
        const parsed = makeParsed({
            blueprint: { ...makeParsed().blueprint, integrationNames: ['NetSuite'] },
        });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.equal(item.integrations[0].logoUrl, 'ew-marketplace://logos/netsuite.png');
    });

    it('caps connectors in setupOverview at 4', () => {
        const parsed = makeParsed({
            blueprint: { ...makeParsed().blueprint, integrationNames: ['A', 'B', 'C', 'D', 'E'] },
        });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.equal(item.setupOverview.connectors.length, 4);
    });

    it('derives workflow names from agentOrchestration, stripping " Agent" suffix', () => {
        const parsed = makeParsed({
            blueprint: { ...makeParsed().blueprint, agentOrchestration: ['Intake Agent', 'Matching Agent'] },
        });
        const { item } = buildCatalogItem('MW-0001', makeSummary(), parsed);
        assert.equal(item.setupOverview.workflows[0].name, 'Intake');
        assert.equal(item.setupOverview.workflows[1].name, 'Matching');
    });

    it('uses fallback workflow when agentOrchestration is empty', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal(item.setupOverview.workflows.length, 1);
        assert.equal(item.setupOverview.workflows[0].name, 'Main Workflow');
    });

    it('always includes a Business Policies memory', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal(item.setupOverview.memories.length, 1);
        assert.equal(item.setupOverview.memories[0].name, 'Business Policies');
    });

    it('derives categories from summary tags', () => {
        const summary = makeSummary({ tags: [{ name: 'demand generation' }] });
        const { item } = buildCatalogItem('MW-0001', summary, makeParsed());
        assert.deepEqual(item.categories, ['Marketing']);
    });

    it('derives non-department tags from summary tags', () => {
        const summary = makeSummary({ tags: [{ name: 'automation' }] });
        const { item } = buildCatalogItem('MW-0001', summary, makeParsed());
        assert.deepEqual(item.tags, ['automation']);
    });

    it('sets setupOverview.setupTime to "30 mins"', () => {
        const { item } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert.equal(item.setupOverview.setupTime, '30 mins');
    });

    it('always includes how-it-works.md in attachments', () => {
        const { attachments } = buildCatalogItem('MW-0001', makeSummary(), makeParsed());
        assert('how-it-works.md' in attachments);
        assert(attachments['how-it-works.md'].startsWith('# How it Works:'));
    });

    it('keeps description inline when it is within the cutoff', () => {
        const { item, attachments } = buildCatalogItem(
            'MW-0001',
            makeSummary({ text_content: 'Short.' }),
            makeParsed(),
        );
        assert.equal(item.description, 'Short.');
        assert(!('description.md' in attachments));
    });

    it('extracts description to attachment when it exceeds the cutoff', () => {
        const longDesc = 'A'.repeat(201);
        const { item, attachments } = buildCatalogItem(
            'MW-0001',
            makeSummary({ text_content: longDesc }),
            makeParsed(),
        );
        assert.deepEqual(item.description, { href: 'ew-marketplace://MW-0001/description.md' });
        assert.equal(attachments['description.md'], longDesc);
    });

    it('keeps overview inline when it is within the cutoff', () => {
        const { item, attachments } = buildCatalogItem(
            'MW-0001',
            makeSummary(),
            makeParsed({ longDescription: 'Short overview.' }),
        );
        assert.equal(item.overview, 'Short overview.');
        assert(!('overview.md' in attachments));
    });

    it('extracts overview to attachment when it exceeds the cutoff', () => {
        const longOverview = 'B'.repeat(201);
        const { item, attachments } = buildCatalogItem(
            'MW-0001',
            makeSummary(),
            makeParsed({ longDescription: longOverview }),
        );
        assert.deepEqual(item.overview, { href: 'ew-marketplace://MW-0001/overview.md' });
        assert.equal(attachments['overview.md'], longOverview);
    });
});

// ── buildHowItWorksMD ─────────────────────────────────────────────────────────

describe('buildHowItWorksMD', () => {
    it('always includes the title heading', () => {
        const md = buildHowItWorksMD(makeSummary({ name: 'My Worker' }), makeParsed({ longDescription: '' }));
        assert(md.startsWith('# How it Works: My Worker\n'));
    });

    it('includes longDescription when present', () => {
        const md = buildHowItWorksMD(makeSummary(), makeParsed({ longDescription: 'It does things.' }));
        assert(md.includes('It does things.'));
    });

    it('omits optional sections when blueprint arrays are empty', () => {
        const md = buildHowItWorksMD(makeSummary(), makeParsed({ longDescription: '' }));
        assert(!md.includes('## Triggers'));
        assert(!md.includes('## Agent Orchestration'));
        assert(!md.includes('## Knowledge Sources'));
        assert(!md.includes('## Outputs'));
    });

    it('includes Triggers section with a bullet list', () => {
        const parsed = makeParsed({ blueprint: { ...makeParsed().blueprint, triggers: ['Email', 'Upload'] } });
        const md = buildHowItWorksMD(makeSummary(), parsed);
        assert(md.includes('## Triggers\n'));
        assert(md.includes('- Email\n'));
        assert(md.includes('- Upload\n'));
    });

    it('includes Agent Orchestration section with a numbered list', () => {
        const parsed = makeParsed({
            blueprint: { ...makeParsed().blueprint, agentOrchestration: ['Intake Agent', 'Matching Agent'] },
        });
        const md = buildHowItWorksMD(makeSummary(), parsed);
        assert(md.includes('## Agent Orchestration\n'));
        assert(md.includes('1. **Intake Agent**\n'));
        assert(md.includes('2. **Matching Agent**\n'));
    });

    it('includes Knowledge Sources section with a bullet list', () => {
        const parsed = makeParsed({ blueprint: { ...makeParsed().blueprint, knowledgeSources: ['PO DB'] } });
        const md = buildHowItWorksMD(makeSummary(), parsed);
        assert(md.includes('## Knowledge Sources\n'));
        assert(md.includes('- PO DB\n'));
    });

    it('includes Outputs section with a bullet list', () => {
        const parsed = makeParsed({ blueprint: { ...makeParsed().blueprint, outputs: ['Payment', 'Audit trail'] } });
        const md = buildHowItWorksMD(makeSummary(), parsed);
        assert(md.includes('## Outputs\n'));
        assert(md.includes('- Payment\n'));
        assert(md.includes('- Audit trail\n'));
    });
});
