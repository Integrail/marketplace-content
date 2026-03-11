import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultAppRegistry, loadAppRegistry } from "./app-registry.js";

const KNOWN_APP_IDS = ["GMail", "NetSuite", "QuickBooks"] as const;

describe("defaultAppRegistry", () => {
    it("contains all known apps", () => {
        for (const appId of KNOWN_APP_IDS) {
            assert(appId in defaultAppRegistry, `defaultAppRegistry is missing "${appId}"`);
        }
    });

    it("each entry has the correct appId, name, logoUrl, and description", () => {
        for (const appId of KNOWN_APP_IDS) {
            const app = defaultAppRegistry[appId];
            assert(app !== undefined);
            assert.equal(app.appId, appId);
            assert(typeof app.name === "string" && app.name.length > 0,
                `${appId}.name must be a non-empty string`);
            assert(typeof app.logoUrl === "string" && app.logoUrl.length > 0,
                `${appId}.logoUrl must be a non-empty string`);
            assert(typeof app.description === "string" && app.description.length > 0,
                `${appId}.description must be a non-empty string`);
        }
    });
});

describe("loadAppRegistry", () => {
    it("returns an empty registry for an empty directory", () => {
        const dir = mkdtempSync(join(tmpdir(), "app-registry-test-"));
        const registry = loadAppRegistry(dir);
        assert.deepEqual(registry, {});
    });

    it("loads app definitions keyed by appId", () => {
        const dir = mkdtempSync(join(tmpdir(), "app-registry-test-"));
        const app = { appId: "GMail", name: "GMail", logoUrl: "ew-marketplace://apps/gmail/logo", description: "ew-marketplace://apps/gmail/description" };
        writeFileSync(join(dir, "GMail.json"), JSON.stringify(app), "utf-8");

        const registry = loadAppRegistry(dir);

        assert.deepEqual(registry["GMail"], app);
    });

    it("ignores non-JSON files in the directory", () => {
        const dir = mkdtempSync(join(tmpdir(), "app-registry-test-"));
        writeFileSync(join(dir, "README.md"), "# ignored", "utf-8");
        writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
        const app = { appId: "NetSuite", name: "NetSuite", logoUrl: "ew-marketplace://apps/netsuite/logo", description: "ew-marketplace://apps/netsuite/description" };
        writeFileSync(join(dir, "NetSuite.json"), JSON.stringify(app), "utf-8");

        const registry = loadAppRegistry(dir);

        assert.deepEqual(Object.keys(registry), ["NetSuite"]);
    });

    it("loads multiple apps, each keyed by its own appId", () => {
        const dir = mkdtempSync(join(tmpdir(), "app-registry-test-"));
        const apps = [
            { appId: "GMail", name: "GMail", logoUrl: "ew-marketplace://apps/gmail/logo", description: "ew-marketplace://apps/gmail/description" },
            { appId: "QuickBooks", name: "QuickBooks", logoUrl: "ew-marketplace://apps/quickbooks/logo", description: "ew-marketplace://apps/quickbooks/description" },
        ];
        for (const app of apps) {
            writeFileSync(join(dir, `${app.appId}.json`), JSON.stringify(app), "utf-8");
        }

        const registry = loadAppRegistry(dir);

        assert.equal(Object.keys(registry).length, 2);
        for (const app of apps) {
            assert.deepEqual(registry[app.appId as keyof typeof registry], app);
        }
    });
});
