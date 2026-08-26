import { describe, expect, it } from "vitest";
import {
  COIN_TO_MONEY_RATE,
  exchangeCoinToMoney,
  exchangeMoneyToCoin,
  buildSeotdaEscrow,
  canAffordSeotdaStake,
  getGirinCoinReward,
  getMinesweeperCoinReward,
  getNumberBaseballCoinReward,
  getOmokCoinReward,
  normalizeSeotdaStake,
  SEOTDA_STAKE_MAX,
  SEOTDA_STAKE_MIN,
  validateStake,
} from "./economy";
import type { AdminEconomySettings } from "./adminEconomy";

const customEconomySettings: AdminEconomySettings = {
  coinToMoneyRate: 250,
  moneyToCoinRate: 240,
  rewards: {
    omok: { win: 450, loss: 50, draw: 200 },
    girin: { answered: 320, stumped: 700 },
    minesweeper: { won: 25, lost: 3 },
    numberBaseball: { win: 450, loss: 50, draw: 200 },
  },
};

describe("economy rules", () => {
  it("requires enough money for a Seotda stake", () => {
    expect(canAffordSeotdaStake(999, 1_000)).toBe(false);
    expect(canAffordSeotdaStake(1_000, 1_000)).toBe(true);
  });

  it("converts 100 coin into 10,000 money", () => {
    expect(exchangeCoinToMoney({ coin: 300, money: 0 }, 100)).toEqual({ coin: 200, money: 10_000 });
    expect(COIN_TO_MONEY_RATE).toBe(100);
  });

  it("uses the independently configured reverse exchange rate when money becomes coin", () => {
    expect(exchangeMoneyToCoin({ coin: 0, money: 20_000 }, 9_500)).toEqual({ coin: 100, money: 10_500 });
    expect(() => exchangeMoneyToCoin({ coin: 0, money: 9_499 }, 9_499)).toThrow();
  });

  it("returns the approved game rewards", () => {
    expect(getOmokCoinReward("win")).toBe(300);
    expect(getOmokCoinReward("loss")).toBe(100);
    expect(getOmokCoinReward("draw")).toBe(200);
    expect(getGirinCoinReward("answered")).toBe(200);
    expect(getGirinCoinReward("stumped")).toBe(500);
    expect(getMinesweeperCoinReward("won")).toBe(10);
    expect(getMinesweeperCoinReward("lost")).toBe(0);
    expect(getNumberBaseballCoinReward("win")).toBe(300);
  });

  it("uses the administrator economy settings when they are supplied", () => {
    expect(exchangeCoinToMoney({ coin: 100, money: 0 }, 100, customEconomySettings)).toEqual({ coin: 0, money: 25_000 });
    expect(exchangeMoneyToCoin({ coin: 0, money: 24_000 }, 24_000, customEconomySettings)).toEqual({ coin: 100, money: 0 });
    expect(getOmokCoinReward("win", customEconomySettings)).toBe(450);
    expect(getGirinCoinReward("stumped", customEconomySettings)).toBe(700);
    expect(getMinesweeperCoinReward("won", customEconomySettings)).toBe(25);
    expect(getMinesweeperCoinReward("lost", customEconomySettings)).toBe(3);
    expect(getNumberBaseballCoinReward("win", customEconomySettings)).toBe(450);
  });

  it("rejects the entire stake when any player is short", () => {
    expect(validateStake(10_000, [
      { id: "host", name: "Host", money: 10_000 },
      { id: "guest", name: "Guest", money: 9_999 },
    ])).toEqual({
      ok: false,
      missing: [{ id: "guest", name: "Guest", balance: 9_999, required: 10_000 }],
    });
  });

  it("normalizes the Seotda stake range and builds one escrow entry per player", () => {
    expect(normalizeSeotdaStake(SEOTDA_STAKE_MIN)).toBe(1);
    expect(normalizeSeotdaStake(SEOTDA_STAKE_MAX)).toBe(1_000_000);
    expect(buildSeotdaEscrow(10_000, [
      { id: "host", name: "Host" },
      { id: "guest", name: "Guest" },
    ])).toEqual({ host: 10_000, guest: 10_000 });
    expect(() => normalizeSeotdaStake(0)).toThrow();
    expect(() => normalizeSeotdaStake(1_000_001)).toThrow();
    expect(() => buildSeotdaEscrow(10_000, [{ id: "host", name: "Host" }])).toThrow();
  });
});
