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


