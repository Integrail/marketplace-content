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
