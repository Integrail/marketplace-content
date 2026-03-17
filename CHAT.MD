Update README.MD file with 
- Grammar fixes
- Logical fixes
- Reference fises
- Explain more precisely what is this
- Check repo structure

Add support for git LFS

Do not build source code or script yet.

//===================================================
Initialize NPM Build tooling project for command line build and  (typescript, vite, mocha)

Add standard NPM/typescript gitignore

//===================================================
In our project we use the following principle for unit tests

Source file: ./src/some-utils.ts
Unit tests: ./src/some-utils.unit.test.ts
Sandbox tests: ./src/some-utils.sandbox.test.ts (tests with require Dockers to run)
Integration tests: ./src/some-utils.integration.test.ts (tests with require full environment to run)

So runners in package.json are
unit-tests
unit-tests:coverage -> add c8
sandbox-tests
sandbox-tests:coverage -> add c8
integration-tests
integration-tests:coverage -> add c8 

Report all coverage report into the root dir .coverage and exclude it from git

//===================================================

Now I need to build the src/model/catalog.ts
I will provide you with screenshort from figma
- Cards view of marketplace catalog items
- details view

//===================================================
I made small changes in the marketplace model, absorb them and fix by best practices you know.
Update unit tests, unit test must read all catalog items and test them for model requirements.
Update catalog if it is wrong (one test item1 for now)

//===================================================
Here is the sample of detailed view of catalog item
Update the model (keep in mind that any markdown text can be embedded of referenced).

Lets do it this way
export interface IEverMarketplaceRef {
    href: IEverMarketplaceUrl;
}

export type IEverMarketplaceMarkdown = string | IEverMarketplaceRef;

Build catalog item structure from screenshot

//===================================================
In the root folder of this repo are two pdf files with description of marketplace items.
Analyse them and build description according the current model

~/workspace/marketplace-content/catalog/End_to_End_AI_Finance_Solution
~/workspace/marketplace-content/catalog/External_Candidate_Sourcing_AI_Worker

//===================================================
I need a demo mode app to show marketplace to the developers who
- Add new catalog items
- Edit/Improve marketplace
- embed new description and properties of items (like tags) to be imported from marketplace (existing functionality)
- Make it in white theme and close to uploaded screenshots
- Do it as simple local vise and react based app.

//===================================================
- Add random hero images (to the catalog)
- Restrict hero image height to 20% of screen height top.
- Add the clear message to the top (It is demo of marketplace content, not actual look and feel of real implementation) 

//===================================================
- I do not see real change in warning, preview is restarted
- Preview must treat catalog as sources and restart on any changes
- Remove [Add Item] buttons and related logic. All changes will be made from source files.
- Dev panel is kind of usable, add the JSON pretty print and ability to expand to hero dialog.

//===================================================
Message to the team.
Hello everyone!

Here is prototype of marketplace-content.
- It contains the catalog items
- Allows to preview in ugly design the items content
- Work faster on marketing things (text, media, etc.)
- Prototype of marketplace validation, build and and deployment system


//===================================================
Instead of this
`EverWorker Marketplace 3 items`

Show this

`EverWorker Marketplace Structure preview 3 items`

Add light orange background to stresses the fact of temporary logical view of structure, not exact design.

//===================================================
I got this.
The demo mode will never be released.
So.
- build of demo app is not required
- rename dev into marketplace-preview
- remove preview as runner of fully built and deployed preview of marketplace
- keep all tests

//===================================================
Message to the team (add at top of README.MD as the top MOTTO section)

Hello everyone!

Here is prototype of marketplace-content.
- It contains the catalog items (you can contribute via pull requests)
- Clone the repo
- See the preview (in ugly design) the marketplace content (npm run marketplace-preview)
- Work faster on marketing things (text, media, etc.)
- Prototype of marketplace validation, build and and deployment system

It is foundation for upcoming month.
//===================================================
There is extracted "./click-up" folder in this repository
It contains ClickUp tasks for catalog items creation

Task path pattern is click-up/tasks/{task id}

For example:
click-up/tasks/MW-1001/MW-1001-summary.json - summary
click-up/tasks/MW-1001/MW-1001-activity.json - discussion
click-up/tasks/MW-1001/attachments - task attachments, PDF mostly. PDFs define catalog item in details:
- Meaning
- Goals
- Market targets
- Savings, etc

Plan:

Step 1: Data extraction

Using poppler do this
- Extract information from PDF into nested MD files, like this
FROM: click-up/tasks/MW-1001/attachments/Accounts Payable (AP) AI Worker.pdf
TO: click-up/tasks/MW-1001/attachments/Accounts Payable (AP) AI Worker.MD

Step 2: Update catalog model with new findings (like daily savings, etc.)

Step 3: For each task
Extract information from summary and PDF about marketplace catalog item and create
actual catalog item in the ./catalog like this
Source data: click-up/tasks/MW-1001
Catalog item: catalog/MW-1001
index.json - item summary

Step 4: Improve demo to with 
- Fake Modal Wizard Dialog for "Setup Worker"
  - Intro and next button
  - Fake installation process 2-3 seconds (nice animated SVG here)
  - Completed page with close and run buttons. Both just close wizard
- Tech details page (show fake popup with some fake tech details same for all items)

//===================================================
1. I need tool improvements (update README as well)
npm run marketplace-preview - start and open preview app in the browser
npm run marketplace-package {demo|prod} - build marketplace distributive (demo by default)
- target ./marketplace-dist/everworker-marketplace-{YYY}-{M}-{D}-{H}.zip
- Zip file must contain the index.json with catalog items reference
- Each catalog item is one MW-XXXX.json file (combine all item information)
- Publish Media data (all non text information) into S3 (in demo into ./marketplace-dist/everworker-marketplace-{YYY}-{M}-{D}-{H}-s3 dir)
npm run marketplace-install-locally
- took recent zip file and add to local mongodb.
- Collection name marketplace_v1. Put items as records, add indexes for search
npm run click-up sync - run "everhow click-up:content-sync" click up sync command

2. Add search to the main page of demo app (client side, simple)

3. Document the marketplace building process in README

- sync click up dir
- ask claude to update marketplace using new information
- ask claude to improve the process step by step (like update only items with in progress status)

For local mongodb use these by default

MONGO_INITDB_ROOT_USERNAME: integrail
MONGO_INITDB_ROOT_PASSWORD: password
MONGO_INITDB_DATABASE: everworker
MONGO_INITDB_MARKETPLACE_COLLECTION: marketplace_v1

//===================================================
Small demo improvements.
- Highlight founded text by some small animation (like fade in/out pulse with 30% brightness or opacity variation every 2 seconds)

//===================================================
Create a CLI script in ./src/cli called sync-model:
- Accept everworker repository path as a parameter (default: ../everworker relative to this project's root)
- Copy *.ts (excluding *.test.ts) files from ./src/model to everworker/imports/core/integrations/marketplace (creating this directory if needed)

//===================================================
In src/lib/catalog-build.ts, implement a function `convertClickUpTaskToCatalogItem` (along with `ClickUpTaskSummary` type) that converts a ClickUp task into a catalog item.
- For a reference example of a ClickUp task, see click-up/tasks/MW-1101/MW-1101-summary.json.
- Catalog item types are described in src/model/catalog.ts.
- Specify a markdown extraction cutoff constant and set to 200. Everywhere where `IEverMarketplaceMarkdown` is used in the catalog item type, the logic is the following: if the content length is <= extraction cutoff, then copy string inline; otherwise, add a ``{ href: `ew-marketplace://${id}/${filename}.md` }`` and add to the attachments a pair ``[`ew-marketplace://${id}/${filename}.md`]: /* content */``.

Make it so that resolveMarkdown function is pure, i.e. doesn't modify attachments but just returns values that are then used on call site

Extract APP_REGISTRY to JSON files src/apps/${name}.json
we don't want to list every single json file in the imports

Let's
1. extract reading app registry to a separate function
2. rename APP_REGISTRY to defaultAppRegistry
3. allow to pass app registry that we're using as an optional parameter to `convertClickUpTaskToCatalogItem` for testing

Now:
1. extract everything concerning reading app registry from src/lib/catalog-build.ts to src/lib/app-registry.ts
2. write unit tests in src/lib/app-registry.unit.test.ts (at least verifying that we're reading default app registry successfully)

From src/lib/catalog-build.ts, extract all functions that are strictly related to parsing ClickUp (and not tied to catalog item types or something else other than ClickUp task structure) to src/lib/clickup-utils.ts; also add src/lib/clickup-utils.unit.test.ts with tests for those functions. In catalog-build.ts, make it a named import (`import * as clickUpUtils from ...`).

In src/lib/catalog-validate.ts, implement the function `assertCatalogItem` that validates that the input is a valid catalog item. For all fields that require somewhat complicated checks, extract them to other `assert*` helpers.

Now, implement `assertCatalogItemResult` in src/lib/catalog-validate.ts, that checks that href's are pointing to existing attachments.

Make sure validation in src/lib/catalog-validate.ts checks for markdown extraction cutoff. Also, write src/lib/catalog-validate.unit.test.ts, where this should be reflected. For now, we're only asserting that inline fields are not exceeding extraction cutoff; NOT that fields that are extracted necessarily DO exceed.

Implement a script src/cli/build-catalog.ts that generally behaves like src/cli/generate-catalog.ts, but uses the new conversion logic (src/lib/catalog-build.ts) and respects the up to date catalog model (src/model/catalog.ts).

In src/lib/catalog-validate.unit.test.ts, add a test that reads the current catalog and validates all items in it.

//===================================================
In src/lib/catalog-build.ts, change `buildCatalogItem` so that:
- if `ITEM_TECH_SPECS_FILE` is defined, it's used as `techSpecsUrl` (as it is right now)
- otherwise, extract TECH-SPECS markdown section, convert it to pdf, add as an attachment, and set `techSpecsUrl` to a ew marketplace reference to that attachment
do all the md->pdf in a separate file, let's call it src/lib/markdown-to-pdf.ts

Right now attachment keys returned from `buildCatalogItem` in src/lib/catalog-build.ts (and used in src/cli/build-catalog.ts) are of this format: `ew-marketplace://MW-1101/full-description.md`. I want you to change that to `full-description.md` instead - just the file name.

//===================================================
I now want src/cli/build-catalog.ts to produce an HTML report at ./reports/catalog-build-report-{DATE}.html. What I want the report to contain:
- successfully built catalog items
- failed to build items and why

//===================================================
Let's rework src/lib/catalog-validate.ts. I want the validation to be able to return a successful result with warnings. I think something like `assertCatalogItem(...): ValidationResult` where `type ValidationResult = { warnings: ...[] }`, and in case of errors an exception is still thrown, is ok. Do you have other suggestions?

> What I'd suggest keeping void: The primitive helpers (assertUrl, assertVersion, assertMarkdown, assertRef, assertMedia, assertAppDefinition, assertDependency) are pure error-checkers with no semantic context to generate warnings. Making them return ValidationResult would just add noise. Only assertCatalogItem and assertCatalogItemResult have enough context to produce meaningful warnings.
> 
> Warning shape: I'd make the warning type explicit rather than just a string, so callers can filter/group by field:
> 
> ```ts
> type ValidationWarning = { field: string; message: string };
> type ValidationResult  = { warnings: ValidationWarning[] };
> ```

Yes let's go with the shape you proposed. For now, don't add any actual warnings, just make sure the types allow to return them and they are propagated between `assertCatalogItem` and `assertCatalogItemResult`.

Ok now I want you to use https://github.com/jfmdev/simple-spellchecker to spell-check text fields in `assertCatalogItem` and add spell check errors as warnings. Here's the doc: https://raw.githubusercontent.com/jfmdev/simple-spellchecker/refs/heads/master/readme.md.

Now I want warnings to be added to the report in src/cli/build-catalog.ts.

//===================================================
Make it so that src/cli/build-catalog.ts also produces catalog/catalog.json file which corresponds to the type `IEverMarketplaceCatalog` (so contains all catalog items and version). For now, use timestamp as the version.

//===================================================
Create a new CLI script in src/cli/publish-catalog.ts.
Parameters:
- branch (default: `main`)
- environment (required)
- push (default: true)
What it should do:
- If there is a folder `media-store`, *and* it is a Git repo, *and* it's origin is https://github.com/Integrail/marketplace-media-store, cd into the folder and switch to the specified branch; otherwise, clone https://github.com/Integrail/marketplace-media-store into `media-store` and switch to the specified branch
- Into `media-store/cdn/{environment}` put:
  - `catalog.json` from `catalog/catalog.json`
  - `catalog.zip` - zipped `catalog.json`
  - `media/{item}` - for each item in `catalog`, e.g. for `MW-1101/` it will be `media/MW-1101/` with all the contents from `catalog/MW-1101/` within it
- Add and commit new files
- Unless push is false, push into the specified branch

I want you to use commander for CLI parsing in src/cli/build-catalog.ts and src/cli/publish-catalog.ts

In src/cli/build-catalog.ts and src/cli/publish-catalog.ts, make sure CLI arguments/options are parsed within `main` and passed as parameters, and are named in `camelCase` rather than `UPPER_SNAKE_CASE` since they are not constants.

Ok now we need to resolve references in `catalog.json` when publishing.
- go over all `IEverMarketplaceCatalogItem` fields that either contain URL's (e.g. `techSpecsUrl`) or `IEverMarketplaceMarkdown` (so possibly `{ href: ... }`, e.g. `fullDescription`)
- replace `ew-marketplace://{path}` with `{media-store-url}/{path}`, where `media-store-path` is a parameter in src/cli/publish-catalog.ts (default: https://marketplace-media.everworker.ai)

//===================================================
Change catalog item model (and `buildCatalogItem` function) to include an optional field `visibility` with the type string. It corresponds to ITEM_PUBLISHING_VISIBILITY ClickUp field.

Update src/lib/catalog-validate.ts to check visibility field; also update src/lib/catalog-validate.unit.test.ts. Don't assume a specific set of values, just check that it is a string or undefined.

//===================================================
Update src/cli/publish-catalog.ts to filter only those items which visibility field matches the environment name (case-insensitive) prefix. I.e. `dev` visibility should match `dev`, `dev-0`, `dev-xx` etc environments.

//===================================================
Create a src/cli/local-deploy.ts script that:
- Reads env (respecting `.env`) for a mongo connection string (`MONGO_URL`)
- Accepts params:
  - `media-store-url` (default: http://marketplace-media.everworker.ai.s3-website.eu-central-1.amazonaws.com/)
  - `mongo-connection-string` (overrides `MONGO_URL` from env)
  - `environment`
- Downloads `{media-store-url}/{environment}/catalog.zip`, extracts `catalog.json from it
- Uploads each catalog item as a document in `marketplace_v1_tmp`
- Deletes `marketplace_v1_backup` if exists, renames `marketplace_v1` into `marketplace_v1_backup` and then renames `marketplace_v1_tmp` into `marketplace_v1`

//===================================================
In src/cli/publish.ts, copy files from src/apps to media-store/cdn/{environment}/apps

In src/cli/publish.ts, now internal links like `ew-marketplace://MW-1101/tech-specs.md` are converted to `{media-store-url}/MW-1101/tech-specs.md`. Make it `{media-store-url}/media/MW-1101/tech-specs.md` instead.

//===================================================
Create a new readme in README2.md.

Flow:
- Tasks are downloaded from ClickUp via `click-up:sync` npm command, and put into `click-up` directory (git-ignored).
- ClickUp tasks are converted to catalog items via `build-catalog` npm command. Use `src/model/catalog.ts` and `src/lib/catalog-build.ts` to document the mapping.
- `bundle.json` and media assets are added manually to catalog item folders.
- Catalog is published to a media store via `publish-catalog` npm command. Read `src/cli/publish-catalog.ts` for more details.
- Catalog is downloaded from media store and installed into a local Mongo database via `local-deploy` npm command. Read `src/cli/local-deploy.ts` for more details.
  - Alternatively, catalog can be installed from Everworker UI, either by selecting a local zip file, or by selecting an environment and automatically downloading the published catalog for that environment from CDN.

Here's the template of a ClickUp task for a catalog item: https://app.clickup.com/t/9015421689/MW-1101.

Without changing any files, give me a summary of what is in README.md that seems to be still relevant but is missing in README2.md

Ok I want you to add to README2.md:

- everhow CLI prerequisite
- ew-marketplace:// explanation (but the one in README.md is outdated so read build-catalog and publish-catalog sources to provide a relevant explanation)
- Git LFS
- full repo directory structure

//===================================================
Modify `src/cli/publish-catalog.ts` so that
- Catalog version is read from catalog.json (e.g. `2026.3.12-1773323902`)
- Along with `catalog.json` and `catalog.zip`, put `catalog-${version}.json` and `catalog-${version}.zip`.
- Put `versions.json` which should just be a JSON array with a list of versions based on existing `catalog-${version}.zip` files.

//===================================================
Modify `src/cli/local-deploy.ts` so that it writes catalog config to a collection `marketplace_v1_config` with a single document with `_id: "config"` and following fields:
- version
- categories

//===================================================
To `src/cli/local-deploy.ts` add an optional parameter `--version`. If it's set, download `catalog-${version}.zip` instead of `catalog.zip`.

//===================================================
Modify `src/lib/catalog-build.ts` so that if a ClickUp attachment is present in `ITEM_BUNDLE_JSON`, the attachment is copied to `bundle.json` file in the catalog folder. Look at `click-up/tasks/MW-1101/MW-1101-summary.json` and `click-up/tasks/MW-1101/attachments/` for an example.

//===================================================
I got this error
"[error] buildCatalogItem failed for MW-1001: AssertionError [ERR_ASSERTION]: cardDescription: inline markdown must be a non-empty string"

Only ClickUp items with non empty custom field ITEM_PUBLISHING_VISIBILITY must be taken into account.


