# marketplace-content

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
│       └── *.*           # Item-related files (images, videos, markdown, etc.)
├── src/                  # Node.js/TypeScript build tool source
├── scripts/              # Shared bash utility scripts
├── scripts-on-prem/      # On-premises deployment scripts (see README inside)
├── scripts-on-aws/       # Deployment scripts for AWS (see README inside)
└── git-lfs.json          # List of file extensions tracked by Git LFS
```

---

## Catalog Content

**Folder:** `./catalog`

Each catalog item lives in its own subdirectory:

| Path | Description |
|------|-------------|
| `./catalog/{item-id}/` | Catalog item folder |
| `./catalog/{item-id}/index.json` | Item definition root (schema: `src/model/catalog.ts`) |
| `./catalog/{item-id}/*.*` | Item-related files (media, markdown, etc.) |

### Internal URL Format

Markdown and JSON files may reference other files within the same item directory using the `ew-marketplace://local/` scheme:

- `ew-marketplace://local/video.mp4` — resolves to `./video.mp4` relative to the item directory
- `ew-marketplace://local/videos/intro.mp4` — resolves to `./videos/intro.mp4` relative to the item directory

---

## NPM Build Tool

**Folder:** `./src`

**Standard files:** `package.json`, `tsconfig.json`, `.env` files for local testing, etc.

The repository includes a Node.js/TypeScript application (with Mocha unit tests) that provides the following capabilities:

### Validation
- Link availability (both `ew-marketplace://local/` and external `http`/`https` URLs)
- JSON file structural validation against TypeScript schemas

### Build
- Exports all media files to S3
- Embeds referenced text, Markdown, and JSON files into a single resulting JSON file (up to 15 MB — the MongoDB document size limit)
- Replaces all internal links with actual public S3 URLs (S3 serves as CDN)
- Produces a deployable marketplace ZIP file

### Build Modes

**Test mode**
- Builds the ZIP file in memory (as a JSON structure)
- Serves a simple Vite web application for quick preview and iteration
- Mirrors the production build pipeline

**Production mode**
- Deploys media files to S3 using the build version as a key prefix
- Resolves all URLs to actual S3 CDN URLs using a `deployment.json` or `deployment.yaml` file (parsed as plain JSON — no advanced YAML features are used)

### CI/CD
- Designed to run in a standard GitHub Actions pipeline

---

## Git LFS

Large binary files (videos, images, etc.) are tracked using [Git LFS](https://git-lfs.github.com/) to keep the repository size small and efficient.

**Config file:** `./git-lfs.json` — lists all file extensions tracked by LFS.

LFS tracking patterns are configured in `.gitattributes` following GitHub's recommendations.

---

## Scripts

**Folder:** `./scripts` — shared bash utility scripts.

**Folder:** `./scripts-on-prem` — scripts for on-premises deployments. See the README inside that folder for details.
