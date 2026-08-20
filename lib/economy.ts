export const COIN_TO_MONEY_RATE = 100;
export const DAILY_ATTENDANCE_COIN_REWARD = 500;
export const SEOTDA_STAKE_MIN = 1;
export const SEOTDA_STAKE_MAX = 1_000_000;

export type Currency = "coin" | "money";
export type OmokRewardResult = "win" | "loss" | "draw";
export type GirinRewardOutcome = "answered" | "stumped";

export interface WalletBalance {
  coin: number;
  money: number;
}

export interface StakeValidation {
  ok: boolean;
  missing: Array<{ id: string; name: string; balance: number; required: number }>;
}

export function normalizeSeotdaStake(value: number): number {
  if (!Number.isInteger(value) || value < SEOTDA_STAKE_MIN || value > SEOTDA_STAKE_MAX) {
    throw new Error(`판돈은 ${SEOTDA_STAKE_MIN}부터 ${SEOTDA_STAKE_MAX}까지 설정할 수 있습니다.`);
  }
  return value;
}

/**
 * Returns the amount that must be locked for each player in a Seotda match.
 * Keeping this as a per-user map makes the all-or-nothing start transaction
 * explicit and leaves room for a later refund/payout record per UUID.
 */
export function buildSeotdaEscrow(
  stake: number,
  players: Array<{ id: string; name: string }>,
): Record<string, number> {
  normalizeSeotdaStake(stake);
  const ids = players.map((player) => player.id);
  if (ids.length < 2 || new Set(ids).size !== ids.length) {
    throw new Error("섯다는 두 명 이상의 서로 다른 참여자가 필요합니다.");
  }
  return Object.fromEntries(ids.map((id) => [id, stake]));
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
}

function assertWalletAmount(wallet: WalletBalance, currency: Currency, amount: number): void {
  assertPositiveInteger(amount, "교환 금액");
  if (wallet[currency] < amount) {
    throw new Error(`${currency} 잔액이 부족합니다.`);
  }
}

export function exchangeCoinToMoney(wallet: WalletBalance, coinAmount: number): WalletBalance {
  assertWalletAmount(wallet, "coin", coinAmount);
  return {
    coin: wallet.coin - coinAmount,
    money: wallet.money + coinAmount * COIN_TO_MONEY_RATE,
  };
}

export function exchangeMoneyToCoin(wallet: WalletBalance, moneyAmount: number): WalletBalance {
  assertWalletAmount(wallet, "money", moneyAmount);
  if (moneyAmount % COIN_TO_MONEY_RATE !== 0) {
    throw new Error(`${COIN_TO_MONEY_RATE}머니 단위로만 코인으로 교환할 수 있습니다.`);
  }
  return {
    coin: wallet.coin + moneyAmount / COIN_TO_MONEY_RATE,
    money: wallet.money - moneyAmount,
  };
}

export function getOmokCoinReward(result: OmokRewardResult): number {
  return result === "win" ? 300 : result === "loss" ? 100 : 200;
}

export function getGirinCoinReward(outcome: GirinRewardOutcome): number {
  return outcome === "answered" ? 200 : 500;
}

export function validateStake(
  stake: number,
  players: Array<{ id: string; name: string; money: number }>,
): StakeValidation {
  normalizeSeotdaStake(stake);

  const missing = players
    .filter((player) => player.money < stake)
    .map((player) => ({
      id: player.id,
      name: player.name,
      balance: player.money,
      required: stake,
    }));

  return { ok: missing.length === 0, missing };
}
