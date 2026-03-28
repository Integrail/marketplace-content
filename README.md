# marketplace-content

This repository manages the Everworker Marketplace catalog — from ClickUp task authoring through publishing to CDN.

## Prerequisites

- **Node.js v22+**
- **Git LFS** — `git lfs install` (for binary assets)
- **ClickUp API token** — obtained from ClickUp → Settings → Apps → API Token

> PDF generation uses [`md-to-pdf`](https://www.npmjs.com/package/md-to-pdf) — no system-level tools (e.g. pandoc) required.

## Install

```sh
git clone git@github.com:Integrail/marketplace-content.git && cd marketplace-content && ./install.sh
```

`install.sh` will:
1. Remove `node_modules` and run a clean `npm install`
2. Run `npm run setup` — validates your ClickUp token (or prompts for one if absent)

Your ClickUp token is stored in `.click-up/settings.json` (git-ignored).

## Overview

```
ClickUp tasks  →  marketplace-build/click-up/  →  marketplace-build/catalog/  →  marketplace-media-store (CDN)
 (authored)           (release:fetch)                 (release:build)                 (release:publish)
```

The `marketplace-build/` directory is git-ignored. Every run of `release:build` starts clean.

## Release workflow

### 1. Fetch tasks from ClickUp

```sh
npm run release:fetch
```

Downloads ClickUp tasks from the MW list and writes them as JSON files into `marketplace-build/click-up/` (git-ignored). Each task produces a `MW-XXXX-summary.json` file.

Sync is configured by `everhow-clickup-sync.json` at the repo root. Your ClickUp token must be set up via `npm run setup` (or `./install.sh`).

ClickUp task template: [MW-1101](https://app.clickup.com/t/9015421689/MW-1101)

### 2. Build the catalog

```sh
npm run release:build
```

Cleans `marketplace-build/catalog/`, then reads every task under `marketplace-build/click-up/tasks/` and converts it to a catalog item.

**Filtering:** Only tasks with a non-empty `ITEM_PUBLISHING_VISIBILITY` custom field are included.

**Error handling:**
- Critical errors (unknown app, empty required fields) halt the build with exit code 1.
- Non-critical errors (PDF generation) are logged and skipped.

Produces:

- `marketplace-build/catalog/MW-XXXX/index.json` — catalog item metadata
- `marketplace-build/catalog/MW-XXXX/full-description.md` — long description (when > 5000 chars)
- `marketplace-build/catalog/MW-XXXX/card-description.md` — short description (when > 5000 chars)
- `marketplace-build/catalog/MW-XXXX/tech-specs.pdf` — generated from `# TECH-SPECS` section
- `marketplace-build/catalog/catalog.json` — full catalog index
- `reports/catalog-build-report-{date}.html` — HTML build report

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

### 3. Publish

```sh
npm run release:publish                   # prompts for scope
npm run release:publish -- --scope prod   # non-interactive
```

Publishes the built catalog to the `marketplace-media-store` sibling repository.

**Versioning:** Each publish auto-increments `build.number` (committed to this repo) and creates a version in the format `YYYY-MM-DD-{N}`.

#### Scope rules

| Scope | Items included (by `visibility`) |
|---|---|
| `prod` | `prod` |
| `qa` | `prod`, `qa` |
| `dev` | `prod`, `qa`, `dev`, `template` |

#### Target directory structure

```
marketplace-media-store/
  cdn/
    {scope}/
      index.json                ← scope version index (rebuilt after every publish)
      {YYYY-MM-DD-N}/           ← version folder
        catalog.json            ← resolved catalog (all URLs absolute)
        catalog.zip             ← zipped catalog.json
        media/
          {item-id}/            ← all item media files
          apps/                 ← app icons and assets
```

#### CDN URLs

```
https://marketplace-media.everworker.ai/{scope}/{version}/catalog.json
https://marketplace-media.everworker.ai/{scope}/{version}/media/{item-id}/{file}
https://marketplace-media.everworker.ai/{scope}/index.json
```

#### Scope index format

`cdn/{scope}/index.json` is rebuilt after every publish to any scope:

```json
{
  "scope": "prod",
  "lastModified": "2026-03-18T12:00:00.000Z",
  "versions": ["2026-03-18-5", "2026-03-17-4"]
}
```

The Everworker admin panel reads these index files to list available versions:
- `https://marketplace-media.everworker.ai/prod/index.json`
- `https://marketplace-media.everworker.ai/qa/index.json`
- `https://marketplace-media.everworker.ai/dev/index.json`

## App registry

All supported integrations are defined in `src/apps/`. Each app has:
- `{Name}.json` — app metadata (`appId`, `name`, `logoUrl`, `description`, `appUrl`)
- `{Name}.txt` — short description text (inlined into the catalog at build time)
- `{Name}.png` / `{Name}.svg` — app logo

The `IEverMarketplaceAppId` type in `src/model/catalog.ts` lists all registered app IDs.

## Repository structure

```
marketplace-content/
├── build.number                    # Auto-incremented build counter (committed)
├── catalog/                        # Legacy — replaced by marketplace-build/catalog/
├── everhow-clickup-sync.json       # ClickUp sync configuration
├── marketplace-build/              # Git-ignored build workspace
│   ├── click-up/tasks/MW-XXXX/     # Synced ClickUp tasks (release:fetch output)
│   └── catalog/                    # Built catalog items (release:build output)
├── reports/                        # HTML build reports (git-ignored)
├── src/
│   ├── apps/                       # App definitions and logos
│   ├── click-up/                   # ClickUp sync (release:fetch)
│   │   ├── clickup-api.ts          # ClickUp API client (native fetch)
│   │   ├── content-sync.ts         # Sync command entry point
│   │   ├── settings.ts             # .click-up/settings.json helpers
│   │   └── setup.ts                # npm run setup entry point
│   ├── cli/                        # CLI scripts
│   │   ├── build-catalog.ts        # release:build
│   │   └── publish-catalog.ts      # release:publish
│   ├── lib/                        # Shared library code
│   ├── model/catalog.ts            # TypeScript interfaces
│   └── preview/                    # React developer preview app
└── vite.config.ts                  # Vite config for the preview app
```

## ew-marketplace:// URL scheme

Files inside catalog item folders are referenced using the `ew-marketplace://` scheme:

```
ew-marketplace://{item-id}/{filename}
ew-marketplace://apps/{filename}
```

These are internal references only. During `release:publish`, every `ew-marketplace://` URL is rewritten to a full CDN URL:

```
ew-marketplace://{item-id}/{file}
  →  https://marketplace-media.everworker.ai/{scope}/{version}/media/{item-id}/{file}
```

## Git LFS

Large binary files are stored in [Git LFS](https://git-lfs.github.com/). Make sure Git LFS is installed (`git lfs install`) before cloning or adding media assets.

Tracked extensions: `*.mp4`, `*.mov`, `*.avi`, `*.webm`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.pdf`, `*.zip`

## Git-ignored directories

| Path | Purpose |
|---|---|
| `.click-up/` | ClickUp API token (local settings) |
| `marketplace-build/` | Build workspace (ClickUp tasks + built catalog) |
| `reports/` | HTML build reports |
| `marketplace-dist/` | Legacy package output |
