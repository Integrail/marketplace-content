# marketplace-content

This repository manages the Everworker Marketplace catalog — from ClickUp task authoring through publishing to CDN and deployment into MongoDB.

## Overview

```
ClickUp tasks  →  click-up/      →  catalog/       →  media-store (CDN)  →  MongoDB
   (authored)     (synced)          (built)            (published)            (deployed)
```

## Workflow

### 1. Sync tasks from ClickUp

```sh
npm run click-up:sync
```

Downloads ClickUp tasks from the MW list and writes them as JSON files into the `click-up/` directory (git-ignored). Each task produces a `MW-XXXX-summary.json` file.

**Prerequisite:** The `everhow` CLI must be installed (ask the team for the install method). Sync is configured by `everhow-clickup-sync.json` at the repo root, which points to the MW ClickUp list.

ClickUp task template: [MW-1101](https://app.clickup.com/t/9015421689/MW-1101)

### 2. Build the marketplace catalog

```sh
npm run build-catalog
```

Reads every `click-up/MW-XXXX-summary.json` and converts it to a catalog item under `catalog/MW-XXXX/`. Produces:

- `catalog/MW-XXXX/index.json` — the catalog item metadata
- `catalog/MW-XXXX/full-description.md` — long-form description (when it exceeds 200 chars)
- `catalog/MW-XXXX/card-description.md` — short description (when it exceeds 200 chars)
- `catalog/MW-XXXX/tech-specs.pdf` — generated from the `# TECH-SPECS` markdown section
- `catalog/catalog.json` — the full catalog index

#### ClickUp → catalog field mapping

| Catalog field | ClickUp source |
|---|---|
| `id` | `custom_id` |
| `itemVersion` | parsed from `date_updated` (epoch ms → `YYYY.M.D-0`) |
| `name` | `name` |
| `cardDescription` | `markdown_description` under `# SHORT-DESC` heading |
| `fullDescription` | `markdown_description` under `# FULL-DESC` heading |
| `type` | custom field `ITEM_TYPE` (dropdown: `Worker` \| `Workflow`) |
| `categoryName` | custom field `ITEM_CATEGORY` (dropdown) |
| `subCategoryName` | custom field `ITEM_SUB_CATEGORY` (dropdown) |
| `benefits` | custom field `ITEM_BENEFITS` (or legacy `ITEM_INCENTIVES`) |
| `installEfforts` | custom field `ITEM_INSTALL_EFFORTS` |
| `primaryApps` | custom field `ITEM_PRIMARY_APPS` (label names resolved via app registry) |
| `apps` | custom field `ITEM_APPS` (label names resolved via app registry) |
| `heroMedia.url` | custom field `ITEM_HERO_MEDIA_URL` or `ITEM_HERO_MEDIA_FILE`, fallback: `ew-marketplace://{id}/hero-media` |
| `bundle.href` | custom field `ITEM_BUNDLE_JSON`, fallback: `ew-marketplace://{id}/bundle.json` |
| `techSpecsUrl` | custom field `ITEM_TECH_SPECS_FILE`, fallback: `# TECH-SPECS` section → converted to PDF |
| `visibility` | custom field `ITEM_PUBLISHING_VISIBILITY` |
| `tags` | task tags |
| `dependencies` | custom fields `ITEM_DEP_CONNECTORS`, `ITEM_DEP_MEMORIES`, `ITEM_DEP_COLLECTIONS`, `ITEM_DEP_WORKFLOWS` (one `Name - Description` entry per line) |

Long markdown fields (`cardDescription`, `fullDescription`) are stored inline when ≤ 200 characters, or as separate `.md` files referenced via `ew-marketplace://` URLs otherwise.

### 3. Add manual assets

For each catalog item, add the following files directly into `catalog/MW-XXXX/` by hand:

- `bundle.json` — the Everworker bundle definition
- `hero-media` (image or video) — shown at the top of the item detail page
- Any other media referenced by the item

These files are committed to the repository.

### 4. Publish the catalog

```sh
npm run publish-catalog -- --environment <env>
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--environment` | *(required)* | Target environment: `prod`, `qa`, `dev-{number}` |
| `--branch` | `main` | Branch in `marketplace-media-store` to publish to |
| `--no-commit` | — | Write files without committing or pushing |
| `--media-store-url` | from `MEDIA_STORE_URL` | Base CDN URL for resolving `ew-marketplace://` refs |

The command:

1. Clones/updates the [marketplace-media-store](https://github.com/Integrail/marketplace-media-store) repo into `media-store/` (sibling directory).
2. Filters catalog items by `visibility`: an item is included when its `visibility` value is a case-insensitive prefix of the environment name (e.g. `visibility: "prod"` is included in `prod` but not `qa`). Items with no visibility are always included.
3. Resolves all `ew-marketplace://` URLs to full CDN URLs under `{mediaStoreUrl}/{environment}/media/`.
4. Writes `cdn/{environment}/catalog.json`, `cdn/{environment}/catalog.zip`, and `cdn/{environment}/media/{id}/` for every item.
5. Commits and pushes to `marketplace-media-store`.

### 5. Deploy locally

```sh
npm run local-deploy -- --environment <env>
```

Options:

| Flag | Env var | Description |
|---|---|---|
| `--environment` | — | Source environment to download from CDN |
| `--media-store-url` | `MEDIA_STORE_URL` | Base URL of the media store |
| `--mongo-connection-string` | `MONGO_URL` | MongoDB connection string |

The command downloads `catalog.zip` from the CDN, extracts `catalog.json`, and performs a zero-downtime rotation into MongoDB:

```
marketplace_v1_tmp  →  marketplace_v1  (live)
marketplace_v1      →  marketplace_v1_backup
```

**Alternative:** From the Everworker UI you can install a catalog by:
- Uploading a local `catalog.zip` file directly, or
- Selecting an environment to fetch the published catalog from CDN.

## Catalog item folder structure

```
catalog/
  catalog.json              ← full catalog index (auto-generated)
  MW-XXXX/
    index.json              ← item metadata (auto-generated)
    bundle.json             ← Everworker bundle (added manually)
    hero-media              ← hero image or video (added manually)
    full-description.md     ← long description (auto-generated when > 200 chars)
    card-description.md     ← short description (auto-generated when > 200 chars)
    tech-specs.pdf          ← tech specs (auto-generated from TECH-SPECS section)
```

## Repository structure

```
marketplace-content/
├── catalog/                        # Built catalog (committed)
│   ├── catalog.json                # Full catalog index (auto-generated by build-catalog)
│   └── MW-XXXX/                    # One folder per catalog item
│       ├── index.json              # Item metadata (auto-generated)
│       ├── bundle.json             # Everworker bundle (added manually)
│       ├── hero-media              # Hero image or video (added manually)
│       ├── full-description.md     # Long description (auto-generated when > 200 chars)
│       ├── card-description.md     # Short description (auto-generated when > 200 chars)
│       └── tech-specs.pdf          # Tech specs (auto-generated from TECH-SPECS section)
├── click-up/                       # ClickUp sync output (git-ignored)
│   └── tasks/
│       └── MW-XXXX/
│           ├── MW-XXXX-summary.json
│           └── attachments/
├── media-store/                    # Local clone of marketplace-media-store (git-ignored)
├── reports/                        # Build reports (HTML, git-ignored)
├── src/
│   ├── apps/                       # App logo and description assets
│   ├── cli/                        # CLI scripts (build-catalog, publish-catalog, etc.)
│   ├── lib/                        # Shared library code
│   ├── model/catalog.ts            # TypeScript interfaces for catalog items
│   └── preview/                    # React developer preview app (npm run marketplace-preview)
├── everhow-clickup-sync.json       # ClickUp sync configuration
├── git-lfs.json                    # File extensions tracked by Git LFS
└── vite.config.ts                  # Vite config for the preview app
```

## ew-marketplace:// URL scheme

Files inside catalog item folders are referenced using the `ew-marketplace://` scheme:

```
ew-marketplace://{item-id}/{filename}
```

Examples:
- `ew-marketplace://MW-1101/bundle.json` → `catalog/MW-1101/bundle.json`
- `ew-marketplace://MW-1101/hero-media` → `catalog/MW-1101/hero-media`
- `ew-marketplace://MW-1101/full-description.md` → `catalog/MW-1101/full-description.md`
- `ew-marketplace://apps/GMail.png` → `src/apps/GMail.png`

These URLs are used throughout `catalog/*/index.json`. They are internal references that only make sense within this repo. During `publish-catalog`, every `ew-marketplace://` URL is rewritten to a full CDN URL:

```
ew-marketplace://{item-id}/{file}
  →  {mediaStoreUrl}/{environment}/media/{item-id}/{file}
```

So consumers (the Everworker app, `local-deploy`) always see plain `https://` URLs and never the internal scheme.

## Git LFS

Large binary files are stored in [Git LFS](https://git-lfs.github.com/) to keep the repository lightweight. The tracked extensions are defined in `git-lfs.json` and configured in `.gitattributes`:

`*.mp4`, `*.mov`, `*.avi`, `*.webm`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.pdf`, `*.zip`

Make sure Git LFS is installed (`git lfs install`) before cloning or adding media assets.

## Git-ignored directories

| Directory | Purpose |
|---|---|
| `click-up/` | Raw ClickUp task JSON files downloaded by `click-up:sync` |
| `media-store/` | Local clone of `marketplace-media-store`, used during publish |
| `reports/` | HTML build reports generated by `build-catalog` |
