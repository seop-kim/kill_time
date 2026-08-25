import type { Currency } from "./economy";

export interface AdminWalletGrant {
  userId: string;
  currency: Currency;
  amount: number;
  reason: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_GRANT_AMOUNT = 1_000_000_000;

export function calculateAdminWalletBalance(balance: number, adjustment: number): number {
  const nextBalance = balance + adjustment;
  if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) {
    throw new Error("잔액을 0 미만으로 회수할 수 없습니다.");
  }
  return nextBalance;
}

export function parseAdminWalletGrant(value: unknown): AdminWalletGrant | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { userId, currency, amount, reason } = value as Record<string, unknown>;
  if (
    typeof userId !== "string" ||
    !UUID_PATTERN.test(userId) ||
    (currency !== "coin" && currency !== "money") ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    amount > MAX_GRANT_AMOUNT ||
    amount < -MAX_GRANT_AMOUNT ||
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.trim().length > 200
  ) {
    return null;
  }

  return { userId, currency, amount, reason: reason.trim() };
}
