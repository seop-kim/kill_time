import { get, onValue, push, ref, runTransaction, update } from "firebase/database";
import { ensureFirebaseAuth, getDb } from "./firebase";
import {
  DAILY_ATTENDANCE_COIN_REWARD,
  exchangeCoinToMoney,
  exchangeMoneyToCoin,
  normalizeSeotdaStake,
  type Currency,
  type WalletBalance,
} from "./economy";

export type WalletProfile = WalletBalance;

export type WalletLedgerType =
  | "game_reward"
  | "attendance"
  | "exchange"
  | "stake"
  | "payout"
  | "refund";

export interface WalletLedgerEntry {
  type: WalletLedgerType;
  gameId?: string;
  matchId?: string;
  roundId?: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  createdAt: number;
}

interface WalletProfileNode {
  wallet?: unknown;
  attendance?: Record<string, unknown> | null;
  walletSettlements?: Record<string, unknown> | null;
  walletExchanges?: Record<string, unknown> | null;
  seotdaStakes?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function profileRef(userId: string) {
  return ref(getDb(), `profiles/${userId}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeBalance(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0;
}

export function normalizeWallet(value: unknown): WalletProfile {
  const raw = asRecord(value);
  return {
    coin: normalizeBalance(raw.coin),
    money: normalizeBalance(raw.money),
  };
}

export function applyWalletDelta(wallet: WalletProfile, currency: Currency, delta: number): WalletProfile {
  if (!Number.isInteger(delta)) throw new Error("지갑 변동량은 정수여야 합니다.");
  const nextBalance = wallet[currency] + delta;
  if (nextBalance < 0) throw new Error(`${currency} 잔액이 부족합니다.`);
  return { ...wallet, [currency]: nextBalance };
}

export function applySeotdaStake(wallet: WalletProfile, stake: number): WalletProfile {
  const normalizedStake = normalizeSeotdaStake(stake);
  return applyWalletDelta(wallet, "money", -normalizedStake);
}

export function applySeotdaPayout(wallet: WalletProfile, amount: number): WalletProfile {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Up 정산 금액은 0 이상의 정수여야 합니다.");
  return applyWalletDelta(wallet, "money", amount);
}

export function buildSettlementId(gameId: string, scopeId: string): string {
  return `${gameId}:${scopeId}`;
}

export function shouldClaimAttendance(
  attendance: Record<string, unknown> | null | undefined,
  dateKey: string,
): boolean {
  return !attendance || !Object.prototype.hasOwnProperty.call(attendance, dateKey);
}

export function shouldSettleWallet(
  settlements: Record<string, unknown> | null | undefined,
  settlementId: string,
): boolean {
  return !settlements || !Object.prototype.hasOwnProperty.call(settlements, settlementId);
}

export function getKstDateKey(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function appendLedger(userId: string, entry: WalletLedgerEntry): Promise<void> {
  const ledgerEntryRef = push(ref(getDb(), `walletLedger/${userId}`));
  if (!ledgerEntryRef.key) throw new Error("지갑 거래 키를 생성하지 못했습니다.");
  await update(ref(getDb()), {
    [`walletLedger/${userId}/${ledgerEntryRef.key}`]: entry,
  });
}

export async function ensureWallet(userId: string): Promise<void> {
  await ensureFirebaseAuth();
  await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    if (profile.wallet) return current;
    return { ...profile, wallet: { coin: 0, money: 0 } };
  });
}

export function subscribeWallet(userId: string, callback: (wallet: WalletProfile) => void): () => void {
  return onValue(ref(getDb(), `profiles/${userId}/wallet`), (snapshot) => {
    callback(normalizeWallet(snapshot.val()));
  });
}

async function readProfileForAction(userId: string): Promise<unknown> {
  await ensureFirebaseAuth();
  // `subscribeWallet` keeps the child wallet query active. Firebase's `get`
  // returns that active query's cache, so read the parent profile for actions
  // that must observe the latest server-confirmed balance.
  const snapshot = await get(profileRef(userId));
  return snapshot.val();
}

export async function getWallet(userId: string): Promise<WalletProfile> {
  return getWalletForAction(userId);
}

export async function getWalletForAction(
  userId: string,
  readProfile: (userId: string) => Promise<unknown> = readProfileForAction,
): Promise<WalletProfile> {
  const profile = asRecord(await readProfile(userId));
  return normalizeWallet(profile.wallet);
}

export async function lockSeotdaStake(userId: string, matchId: string, stake: number, now = Date.now()): Promise<boolean> {
  const normalizedStake = normalizeSeotdaStake(stake);
  let locked = false;
  let balanceAfter = 0;
  const result = await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    const stakes = profile.seotdaStakes ?? {};
    if (Object.prototype.hasOwnProperty.call(stakes, matchId)) return current;

    const wallet = applySeotdaStake(normalizeWallet(profile.wallet), normalizedStake);
    locked = true;
    balanceAfter = wallet.money;
    return {
      ...profile,
      wallet,
      seotdaStakes: {
        ...stakes,
        [matchId]: { stake: normalizedStake, createdAt: now },
      },
    };
  });

  if (!result.committed || !locked) return false;
  await appendLedger(userId, {
    type: "stake",
    gameId: "seotda",
    matchId,
    currency: "money",
    amount: -normalizedStake,
    balanceAfter,
    createdAt: now,
  });
  return true;
}

export async function settleSeotdaMatch(userId: string, matchId: string, amount: number, now = Date.now()): Promise<boolean> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Up 정산 금액은 0 이상의 정수여야 합니다.");
  const settlementId = buildSettlementId("seotda", matchId);
  let settled = false;
  let balanceAfter = 0;
  const result = await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    const settlements = profile.walletSettlements ?? {};
    if (!shouldSettleWallet(settlements, settlementId)) return current;

    const wallet = applySeotdaPayout(normalizeWallet(profile.wallet), amount);
    settled = true;
    balanceAfter = wallet.money;
    return {
      ...profile,
      wallet,
      walletSettlements: {
        ...settlements,
        [settlementId]: { gameId: "seotda", matchId, moneyDelta: amount, createdAt: now },
      },
    };
  });

  if (!result.committed || !settled) return false;
  if (amount > 0) {
    await appendLedger(userId, {
      type: "payout",
      gameId: "seotda",
      matchId,
      currency: "money",
      amount,
      balanceAfter,
      createdAt: now,
    });
  }
  return true;
}

export function subscribeAttendance(userId: string, dateKey: string, callback: (claimed: boolean) => void): () => void {
  return onValue(ref(getDb(), `profiles/${userId}/attendance/${dateKey}`), (snapshot) => {
    callback(snapshot.exists());
  });
}

export async function claimDailyAttendance(
  userId: string,
  dateKey = getKstDateKey(),
  now = Date.now(),
): Promise<boolean> {
  let claimed = false;
  let balanceAfter = 0;

  const result = await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    const attendance = profile.attendance ?? {};
    if (!shouldClaimAttendance(attendance, dateKey)) {
      claimed = false;
      return current;
    }

    const wallet = applyWalletDelta(normalizeWallet(profile.wallet), "coin", DAILY_ATTENDANCE_COIN_REWARD);
    claimed = true;
    balanceAfter = wallet.coin;
    return {
      ...profile,
      wallet,
      attendance: {
        ...attendance,
        [dateKey]: { claimedAt: now, reward: DAILY_ATTENDANCE_COIN_REWARD },
      },
    };
  });

  if (!result.committed || !claimed) return false;
  await appendLedger(userId, {
    type: "attendance",
    currency: "coin",
    amount: DAILY_ATTENDANCE_COIN_REWARD,
    balanceAfter,
    createdAt: now,
  });
  return true;
}

export async function exchangeCoinMoney(
  userId: string,
  direction: "coinToMoney" | "moneyToCoin",
  amount: number,
  now = Date.now(),
): Promise<void> {
  const operationRef = push(ref(getDb(), `walletExchanges/${userId}`));
  if (!operationRef.key) throw new Error("환전 거래 키를 생성하지 못했습니다.");
  const operationId = operationRef.key;

  const result = await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    const wallet = normalizeWallet(profile.wallet);
    const nextWallet = direction === "coinToMoney"
      ? exchangeCoinToMoney(wallet, amount)
      : exchangeMoneyToCoin(wallet, amount);
    const coinDelta = nextWallet.coin - wallet.coin;
    const moneyDelta = nextWallet.money - wallet.money;
    return {
      ...profile,
      wallet: nextWallet,
      walletExchanges: {
        ...(profile.walletExchanges ?? {}),
        [operationId]: { direction, amount, coinDelta, moneyDelta, createdAt: now },
      },
    };
  });

  if (!result.committed) throw new Error("환전 처리에 실패했습니다.");
  const nextWallet = normalizeWallet(result.snapshot.child("wallet").val());
  await appendLedger(userId, {
    type: "exchange",
    currency: direction === "coinToMoney" ? "coin" : "money",
    amount: direction === "coinToMoney" ? -amount : -amount,
    balanceAfter: direction === "coinToMoney" ? nextWallet.coin : nextWallet.money,
    createdAt: now,
  });
}

export async function settleCoinReward(
  userId: string,
  gameId: string,
  scopeId: string,
  amount: number,
  now = Date.now(),
): Promise<boolean> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("보상 코인은 1 이상의 정수여야 합니다.");
  const settlementId = buildSettlementId(gameId, scopeId);
  let settled = false;
  let balanceAfter = 0;

  const result = await runTransaction(profileRef(userId), (current) => {
    const profile = asRecord(current) as WalletProfileNode;
    const settlements = profile.walletSettlements ?? {};
    if (!shouldSettleWallet(settlements, settlementId)) {
      settled = false;
      return current;
    }

    const wallet = applyWalletDelta(normalizeWallet(profile.wallet), "coin", amount);
    settled = true;
    balanceAfter = wallet.coin;
    return {
      ...profile,
      wallet,
      walletSettlements: {
        ...settlements,
        [settlementId]: { gameId, scopeId, coinDelta: amount, createdAt: now },
      },
    };
  });

  if (!result.committed || !settled) return false;
  await appendLedger(userId, {
    type: "game_reward",
    gameId,
    currency: "coin",
    amount,
    balanceAfter,
    createdAt: now,
  });
  return true;
}
