import "server-only";

import type { Currency } from "./economy";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, normalizeAdminEconomySettings, type AdminEconomySettings } from "./adminEconomy";
import { buildFinishedGameRecord, type GameRecord } from "./adminRecords";
import { getAdminDatabase } from "./firebaseAdmin";
import type { Room } from "./rooms";

export interface AdminAuditEntry {
  type: "economy_updated" | "wallet_granted";
  administrator: string;
  createdAt: number;
  details: Record<string, unknown>;
}

export interface AdminUserSummary {
  userId: string;
  nickname: string;
  coin: number;
  money: number;
  games: Record<string, unknown>;
}

export interface AdminChatLog {
  id: string;
  roomCode: string;
  name: string;
  text: string;
  by: string;
  at: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeBalance(value: unknown): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

function limitResults(value: number | undefined, fallback = 100) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(1, Math.min(value as number, 200));
}

function pushKey(path: string) {
  const key = getAdminDatabase().ref(path).push().key;
  if (!key) throw new Error("관리자 로그 키를 생성하지 못했습니다.");
  return key;
}

async function writeAudit(entry: AdminAuditEntry) {
  const key = pushKey("adminAuditLogs");
  await getAdminDatabase().ref(`adminAuditLogs/${key}`).set(entry);
}

export function isFirebaseAdminConfigured() {
  return Boolean(
    (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || (
      process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    )) &&
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  );
}

export async function getAdminEconomySettings(): Promise<AdminEconomySettings> {
  const snapshot = await getAdminDatabase().ref("adminSettings/economy").once("value");
  return normalizeAdminEconomySettings(snapshot.val());
}

export async function saveAdminEconomySettings(
  value: unknown,
  administrator: string,
  now = Date.now(),
): Promise<AdminEconomySettings> {
  const settings = normalizeAdminEconomySettings(value);
  await getAdminDatabase().ref("adminSettings/economy").set(settings);
  await writeAudit({
    type: "economy_updated",
    administrator,
    createdAt: now,
    details: { settings },
  });
  return settings;
}

export async function grantAdminWallet(
  input: { userId: string; currency: Currency; amount: number; reason: string },
  administrator: string,
  now = Date.now(),
): Promise<{ balanceAfter: number }> {
  const profileRef = getAdminDatabase().ref(`profiles/${input.userId}`);
  let balanceAfter = 0;
  const result = await profileRef.transaction((current) => {
    const profile = asRecord(current);
    const wallet = asRecord(profile.wallet);
    const previous = normalizeBalance(wallet[input.currency]);
    balanceAfter = previous + input.amount;
    return {
      ...profile,
      wallet: {
        coin: normalizeBalance(wallet.coin),
        money: normalizeBalance(wallet.money),
        [input.currency]: balanceAfter,
      },
    };
  });
  if (!result.committed) throw new Error("지갑 지급 처리에 실패했습니다.");

  const ledgerKey = pushKey(`walletLedger/${input.userId}`);
  const auditKey = pushKey("adminAuditLogs");
  await getAdminDatabase().ref().update({
    [`walletLedger/${input.userId}/${ledgerKey}`]: {
      type: "admin_grant",
      currency: input.currency,
      amount: input.amount,
      balanceAfter,
      createdAt: now,
      reason: input.reason,
      administrator,
    },
    [`adminAuditLogs/${auditKey}`]: {
      type: "wallet_granted",
      administrator,
      createdAt: now,
      details: { ...input, balanceAfter },
    } satisfies AdminAuditEntry,
  });
  return { balanceAfter };
}

export async function findAdminUsers(query: string, limit?: number): Promise<AdminUserSummary[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const max = limitResults(limit, 50);
  const snapshot = await getAdminDatabase().ref("profiles").once("value");
  const matches: AdminUserSummary[] = [];
  for (const [userId, rawProfile] of Object.entries(asRecord(snapshot.val()))) {
    const profile = asRecord(rawProfile);
    const nickname = typeof profile.nickname === "string" ? profile.nickname : "";
    if (userId.toLowerCase() !== needle && nickname.toLowerCase() !== needle) continue;
    const wallet = asRecord(profile.wallet);
    matches.push({
      userId,
      nickname,
      coin: normalizeBalance(wallet.coin),
      money: normalizeBalance(wallet.money),
      games: asRecord(profile.games),
    });
    if (matches.length >= max) break;
  }
  return matches;
}

export async function listAdminChatLogs(
  filters: { roomCode?: string; query?: string; limit?: number } = {},
): Promise<AdminChatLog[]> {
  const roomCode = filters.roomCode?.trim().toUpperCase();
  const query = filters.query?.trim().toLowerCase();
  const snapshot = await getAdminDatabase().ref("chatLogs").once("value");
  const logs: AdminChatLog[] = [];
  for (const [storedRoomCode, rawMessages] of Object.entries(asRecord(snapshot.val()))) {
    if (roomCode && storedRoomCode !== roomCode) continue;
    for (const [id, rawMessage] of Object.entries(asRecord(rawMessages))) {
      const message = asRecord(rawMessage);
      const name = typeof message.name === "string" ? message.name : "";
      const text = typeof message.text === "string" ? message.text : "";
      if (query && !name.toLowerCase().includes(query) && !text.toLowerCase().includes(query)) continue;
      logs.push({
        id,
        roomCode: typeof message.roomCode === "string" ? message.roomCode : storedRoomCode,
        name,
        text,
        by: typeof message.by === "string" ? message.by : "unknown",
        at: Number.isFinite(Number(message.at)) ? Number(message.at) : 0,
      });
    }
  }
  return logs.sort((left, right) => right.at - left.at).slice(0, limitResults(filters.limit));
}

export async function listGameRecords(
  filters: { gameId?: string; roomCode?: string; limit?: number } = {},
): Promise<GameRecord[]> {
  const requestedGameId = filters.gameId?.trim();
  const requestedRoomCode = filters.roomCode?.trim().toUpperCase();
  const snapshot = await getAdminDatabase().ref("gameLogs").once("value");
  const records = Object.values(asRecord(snapshot.val()))
    .map((value) => value as GameRecord)
    .filter((record) => record && typeof record === "object")
    .filter((record) => !requestedGameId || record.gameId === requestedGameId)
    .filter((record) => !requestedRoomCode || record.roomCode === requestedRoomCode)
    .sort((left, right) => right.finishedAt - left.finishedAt);
  return records.slice(0, limitResults(filters.limit));
}

export async function archiveFinishedGameRecord(roomCode: string, now = Date.now()): Promise<GameRecord | null> {
  const normalizedRoomCode = roomCode.trim().toUpperCase();
  const snapshot = await getAdminDatabase().ref(`rooms/${normalizedRoomCode}`).once("value");
  const room = snapshot.val() as Room | null;
  if (!room) return null;
  const record = buildFinishedGameRecord(normalizedRoomCode, room, now);
  if (!record) return null;
  await getAdminDatabase().ref(`gameLogs/${record.id}`).transaction((current) => current ?? record);
  return record;
}

export function getDefaultAdminEconomySettings() {
  return DEFAULT_ADMIN_ECONOMY_SETTINGS;
}
