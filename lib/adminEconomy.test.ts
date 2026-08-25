import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, normalizeAdminEconomySettings } from "./adminEconomy";

describe("administrator economy settings", () => {
  it("uses administrator-configured exchange and game rewards", () => {
    expect(normalizeAdminEconomySettings({
      coinToMoneyRate: 250,
      moneyToCoinRate: 240,
      rewards: {
        omok: { win: 450, loss: 50, draw: 200 },
        girin: { answered: 320, stumped: 700 },
        minesweeper: { won: 25, lost: 3 },
      },
    })).toEqual({
      coinToMoneyRate: 250,
      moneyToCoinRate: 240,
      rewards: {
        omok: { win: 450, loss: 50, draw: 200 },
        girin: { answered: 320, stumped: 700 },
        minesweeper: { won: 25, lost: 3 },
      },
    });
  });

  it("keeps the last safe value for missing or invalid persisted values", () => {
    expect(normalizeAdminEconomySettings({
      coinToMoneyRate: -100,
      moneyToCoinRate: 0,
      rewards: {
        omok: { win: "many", loss: -1 },
        girin: { answered: 100.5 },
        minesweeper: { won: Number.POSITIVE_INFINITY },
      },
    })).toEqual(DEFAULT_ADMIN_ECONOMY_SETTINGS);
  });
});
