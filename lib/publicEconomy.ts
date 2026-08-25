import { DEFAULT_ADMIN_ECONOMY_SETTINGS, normalizeAdminEconomySettings, type AdminEconomySettings } from "./adminEconomy";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function loadPublicEconomySettings(fetcher: Fetcher = fetch): Promise<AdminEconomySettings> {
  try {
    const response = await fetcher("/api/economy", { cache: "no-store" });
    if (!response.ok) return DEFAULT_ADMIN_ECONOMY_SETTINGS;
    const payload = await response.json() as { settings?: unknown };
    return normalizeAdminEconomySettings(payload.settings);
  } catch {
    return DEFAULT_ADMIN_ECONOMY_SETTINGS;
  }
}
