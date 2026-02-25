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
