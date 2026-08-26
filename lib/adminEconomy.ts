export type AdminEconomySettings = {
  coinToMoneyRate: number;
  /** Money required to receive one coin when exchanging in reverse. */
  moneyToCoinRate: number;
  rewards: {
    omok: { win: number; loss: number; draw: number };
    girin: { answered: number; stumped: number };
    minesweeper: { won: number; lost: number };
    numberBaseball: { win: number; loss: number; draw: number };
  };
};

export const DEFAULT_ADMIN_ECONOMY_SETTINGS: AdminEconomySettings = {
  coinToMoneyRate: 100,
  moneyToCoinRate: 95,
  rewards: {
    omok: { win: 300, loss: 100, draw: 200 },
    girin: { answered: 200, stumped: 500 },
    minesweeper: { won: 10, lost: 0 },
    numberBaseball: { win: 300, loss: 100, draw: 200 },
  },
};

const MAX_ECONOMY_VALUE = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNonNegativeInteger(value: unknown, fallback: number, allowZero = true) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value > MAX_ECONOMY_VALUE || value < (allowZero ? 0 : 1)) {
    return fallback;
  }

  return value;
}

export function normalizeAdminEconomySettings(value: unknown): AdminEconomySettings {
  const raw = isRecord(value) ? value : {};
  const rewards = isRecord(raw.rewards) ? raw.rewards : {};
  const omok = isRecord(rewards.omok) ? rewards.omok : {};
  const girin = isRecord(rewards.girin) ? rewards.girin : {};
  const minesweeper = isRecord(rewards.minesweeper) ? rewards.minesweeper : {};
  const numberBaseball = isRecord(rewards.numberBaseball) ? rewards.numberBaseball : {};

  return {
    coinToMoneyRate: safeNonNegativeInteger(raw.coinToMoneyRate, DEFAULT_ADMIN_ECONOMY_SETTINGS.coinToMoneyRate, false),
    moneyToCoinRate: safeNonNegativeInteger(raw.moneyToCoinRate, DEFAULT_ADMIN_ECONOMY_SETTINGS.moneyToCoinRate, false),
    rewards: {
      omok: {
        win: safeNonNegativeInteger(omok.win, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.omok.win),
        loss: safeNonNegativeInteger(omok.loss, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.omok.loss),
        draw: safeNonNegativeInteger(omok.draw, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.omok.draw),
      },
      girin: {
        answered: safeNonNegativeInteger(girin.answered, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.girin.answered),
        stumped: safeNonNegativeInteger(girin.stumped, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.girin.stumped),
      },
      minesweeper: {
        won: safeNonNegativeInteger(minesweeper.won, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.minesweeper.won),
        lost: safeNonNegativeInteger(minesweeper.lost, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.minesweeper.lost),
      },
      numberBaseball: {
        win: safeNonNegativeInteger(numberBaseball.win, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.numberBaseball.win),
        loss: safeNonNegativeInteger(numberBaseball.loss, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.numberBaseball.loss),
        draw: safeNonNegativeInteger(numberBaseball.draw, DEFAULT_ADMIN_ECONOMY_SETTINGS.rewards.numberBaseball.draw),
      },
    },
  };
}
