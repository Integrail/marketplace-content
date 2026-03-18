import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { IEverMarketplaceAppDefinition, IEverMarketplaceAppId } from "../model/catalog";

export type AppRegistry = Partial<Record<IEverMarketplaceAppId, IEverMarketplaceAppDefinition>>;

export function loadAppRegistry(dir: string): AppRegistry {
    return Object.fromEntries(
        readdirSync(dir)
            .filter(f => f.endsWith(".json"))
            .map(f => {
                const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as IEverMarketplaceAppDefinition & { description: string };
                const descUrl = raw.description;
                let description: string = descUrl;
                if (descUrl.startsWith("ew-marketplace://apps/") && descUrl.endsWith(".txt")) {
                    const txtFile = join(dir, descUrl.replace("ew-marketplace://apps/", ""));
                    try { description = readFileSync(txtFile, "utf-8").trim(); } catch { /* keep url */ }
                }
                // Fall back to default icon if the app's PNG doesn't exist on disk
                let logoUrl = raw.logoUrl;
                if (logoUrl.startsWith("ew-marketplace://apps/")) {
                    const logoFile = join(dir, logoUrl.replace("ew-marketplace://apps/", ""));
                    if (!existsSync(logoFile)) {
                        logoUrl = "ew-marketplace://defaults/default-app-icon.png";
                    }
                }

                const app: IEverMarketplaceAppDefinition = { ...raw, description, logoUrl };
                return [app.appId, app];
            }),
    );
}

export const defaultAppRegistry: AppRegistry =
    loadAppRegistry(join(fileURLToPath(import.meta.url), "../../apps"));
