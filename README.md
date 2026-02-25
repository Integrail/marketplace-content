# marketplace-content

---

> **Hello everyone!**
>
> Here is the prototype of **marketplace-content**.
> - It contains the catalog items — you can contribute via pull requests
> - Clone the repo
> - See the preview (in ugly design) of the marketplace content: `npm run marketplace-preview`
> - Work faster on marketing things (text, media, etc.)
> - Prototype of marketplace validation, build and deployment system
>
> **It is the foundation for the upcoming month.**

---

This repository contains the **Everworker Marketplace** content and build tooling.

The marketplace is a curated catalog of pre-built workflows that can be deployed into customer environments. This repository serves two purposes:

1. **Content** — the catalog of marketplace items (workflows, media, documentation)
2. **Build tooling** — a Node.js/TypeScript application to validate, build, and deploy marketplace content

Customers can import marketplace workflows and modify them as needed. The internal format of imported workflows (opaque JSON files) is out of scope for this repository.

---

# Repository Structure

```
marketplace-content/
├── catalog/              # Source catalog content
│   └── {item-id}/        # One folder per catalog item
│       ├── index.json    # Item definition (schema: src/model/catalog.ts)
│       ├── how-it-works.md
│       └── *.*           # Item-related files (images, videos, etc.)
├── click-up/             # ClickUp task data synced from the board
│   └── tasks/
│       └── MW-XXXX/      # One folder per task
│           ├── MW-XXXX-summary.json
│           └── attachments/
├── marketplace-dist/     # Build output (git-ignored)
│   ├── *.zip             # Distribution archives
│   └── *-s3/             # Demo media files (S3 simulation)
├── src/                  # Node.js/TypeScript build tool source
│   ├── cli/              # CLI scripts
│   ├── model/catalog.ts  # TypeScript interfaces
│   └── preview/          # React developer preview app
├── everhow-clickup-sync.json  # ClickUp sync configuration
└── git-lfs.json          # List of file extensions tracked by Git LFS
```

---

# NPM Commands

## `npm run marketplace-preview`

Starts the Vite dev server and opens the preview app in the browser.

The preview app shows all catalog items in a grid with:
- **Search** — filter by name, category, integration, or tag (client-side, instant)
- **Detail view** — click any card to see the full item detail
- **Dev Panel** — toggle raw JSON inspector in the detail view

Hot-reloads whenever a file in `catalog/` changes.

---

## `npm run marketplace-package [demo|prod]`

Builds a versioned marketplace distribution ZIP.

```bash
npm run marketplace-package           # demo mode (default)
npm run marketplace-package -- prod   # production mode
```

**Output:** `./marketplace-dist/everworker-marketplace-{YYYY}-{M}-{D}-{H}.zip`

**ZIP contents:**
| File | Description |
|------|-------------|
| `index.json` | Catalog manifest — version, mode, S3 base URL, item list |
| `MW-XXXX.json` | One file per catalog item — full combined data, markdown resolved inline, URLs rewritten |

**What it does:**
1. Reads all `catalog/*/index.json` files
2. Resolves `howItWorks` / `overview` markdown refs → inlines the content
3. Copies non-text files (images, video) to the `-s3/` directory (demo) or logs paths for S3 upload (prod)
4. Rewrites all `ew-marketplace://` URLs to point to the S3 location
5. Writes the ZIP to `marketplace-dist/`

**Demo mode** — media goes to: `./marketplace-dist/everworker-marketplace-{...}-s3/`

**Production mode** — set `S3_BASE_URL` env var to your S3 bucket base URL. Media upload stubs are logged; wire up actual S3 SDK calls in `src/cli/package-marketplace.ts`.

---

## `npm run marketplace-install-locally`

Loads the most recent ZIP from `marketplace-dist/` and upserts all catalog items into a local MongoDB instance.

```bash
npm run marketplace-install-locally

# Custom connection:
MONGODB_URI=mongodb://localhost:27017 MONGODB_DB=everworker npm run marketplace-install-locally
```

**Collection:** `marketplace_v1`

**Indexes created:**
| Index | Fields | Notes |
|-------|--------|-------|
| `id_unique` | `id` | Primary unique key |
| `text_search` | `name`, `description` | Full-text search |
| `categories_idx` | `categories` | Array index |
| `tags_idx` | `tags` | Array index |
| `type_idx` | `type` | Single-field |

Requires MongoDB running locally (default: `mongodb://localhost:27017`).

---

## `npm run click-up:sync`

Syncs ClickUp task data into the `click-up/tasks/` directory.

```bash
npm run click-up:sync
```

Runs `everhow click-up:content-sync` using the configuration in `everhow-clickup-sync.json`.

**Prerequisite:** `everhow` CLI must be installed globally (`npm install -g everhow` or your team's install method).

---

# Marketplace Building Process

This is the full end-to-end workflow to update and publish the marketplace.

## Step 1 — Sync ClickUp

Pull the latest task data from ClickUp into the local `click-up/` directory:

```bash
npm run click-up:sync
```

This updates `click-up/tasks/MW-XXXX/` directories with the latest task summaries and PDF attachments.

## Step 2 — Regenerate Catalog Items

Ask Claude to update catalog items from the new ClickUp data:

```bash
npx tsx src/cli/generate-catalog.ts
```

Or selectively update specific items:

```bash
npx tsx src/cli/generate-catalog.ts --ids=MW-1001,MW-1005
npx tsx src/cli/generate-catalog.ts --dry-run   # preview without writing
```

**With Claude Code** — you can ask Claude to process items intelligently, for example:

> *"Update only the catalog items whose ClickUp status is 'In Progress' using the new sync data"*

> *"Improve the descriptions for MW-1010 through MW-1020 based on the PDF content"*

> *"Add missing key results to all Finance category items"*

## Step 3 — Preview

Review changes in the browser before packaging:

```bash
npm run marketplace-preview
```

Use the **search bar** to quickly find items, and the **Dev Panel** to inspect raw JSON.

## Step 4 — Package

Build the distribution archive:

```bash
npm run marketplace-package           # demo
npm run marketplace-package -- prod   # production
```

## Step 5 — Install Locally (optional)

Load the distribution into local MongoDB for integration testing:

```bash
npm run marketplace-install-locally
```

Query example (MongoDB shell):
```js
db.marketplace_v1.find({ $text: { $search: "invoice processing" } })
db.marketplace_v1.find({ categories: "Finance" }).count()
```

---

# Catalog Content

**Folder:** `./catalog`

Each catalog item lives in its own subdirectory:

| Path | Description |
|------|-------------|
| `./catalog/{item-id}/` | Catalog item folder |
| `./catalog/{item-id}/index.json` | Item definition root (schema: `src/model/catalog.ts`) |
| `./catalog/{item-id}/how-it-works.md` | Long-form how-it-works content |
| `./catalog/{item-id}/*.*` | Item-related files (media, etc.) |

### Internal URL Format

Markdown and JSON files may reference other files within the same item directory using the `ew-marketplace://` scheme:

- `ew-marketplace://MW-1001/hero.png` — resolves to `catalog/MW-1001/hero.png`
- `ew-marketplace://MW-1001/how-it-works.md` — resolves to `catalog/MW-1001/how-it-works.md`
- `ew-marketplace://shared/integrail-avatar.png` — shared asset

During packaging, all `ew-marketplace://` URLs are rewritten to S3 URLs (or local `file://` paths in demo mode).

---

## NPM Build Tool

**Folder:** `./src`

### Validation
- JSON file structural validation against TypeScript schemas

### Build (`src/cli/package-marketplace.ts`)
- Resolves all markdown refs to inline strings
- Copies media to S3 (or simulated S3 directory in demo mode)
- Replaces all internal `ew-marketplace://` links with actual S3 URLs
- Produces a versioned ZIP distribution

### Local Install (`src/cli/install-locally.ts`)
- Reads the latest ZIP from `marketplace-dist/`
- Upserts all items into MongoDB `marketplace_v1` collection
- Creates text and field indexes for search

### Preview App (`src/preview/`)
- React app served by Vite
- Client-side search (name, description, category, tags, integrations)
- Item detail view with markdown rendering
- Dev Panel for raw JSON inspection

### Generate Catalog (`src/cli/generate-catalog.ts`)
- Parses ClickUp task PDF attachments (`.MD` files)
- Generates `index.json` + `how-it-works.md` for each MW-XXXX item

---

## Git LFS

Large binary files (videos, images, etc.) are tracked using [Git LFS](https://git-lfs.github.com/) to keep the repository size small and efficient.

**Config file:** `./git-lfs.json` — lists all file extensions tracked by LFS.

LFS tracking patterns are configured in `.gitattributes` following GitHub's recommendations.
