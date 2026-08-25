import { describe, expect, it } from "vitest";
import { loadPublicEconomySettings } from "./publicEconomy";

describe("public economy settings", () => {
  it("uses the settings returned by the server", async () => {
    const settings = await loadPublicEconomySettings(async () => new Response(JSON.stringify({
      settings: {
        coinToMoneyRate: 250,
        rewards: {
          omok: { win: 450, loss: 50, draw: 200 },
          girin: { answered: 320, stumped: 700 },
          minesweeper: { won: 25, lost: 0 },
        },
      },
    }), { status: 200 }));

    expect(settings.coinToMoneyRate).toBe(250);
    expect(settings.rewards.girin.stumped).toBe(700);
  });

  it("falls back to the approved defaults when the settings endpoint is unavailable", async () => {
    const settings = await loadPublicEconomySettings(async () => new Response("", { status: 503 }));

    expect(settings).toMatchObject({
      coinToMoneyRate: 100,
      rewards: { omok: { win: 300 }, minesweeper: { won: 10 } },
    });
  });
});
