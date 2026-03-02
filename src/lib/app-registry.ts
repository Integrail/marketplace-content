import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { IEverMarketplaceAppDefinition, IEverMarketplaceAppId } from "../model/catalog";

export type AppRegistry = Partial<Record<IEverMarketplaceAppId, IEverMarketplaceAppDefinition>>;

export function loadAppRegistry(dir: string): AppRegistry {
    return Object.fromEntries(
        readdirSync(dir)
            .filter(f => f.endsWith(".json"))
            .map(f => {
                const app = JSON.parse(readFileSync(join(dir, f), "utf-8")) as IEverMarketplaceAppDefinition;
                return [app.appId, app];
            }),
    );
}

export const defaultAppRegistry: AppRegistry =
    loadAppRegistry(join(fileURLToPath(import.meta.url), "../../apps"));
