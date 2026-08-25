import "server-only";

import type { Currency } from "./economy";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, normalizeAdminEconomySettings, type AdminEconomySettings } from "./adminEconomy";
import { summarizeChatRooms, summarizeGameRooms, type AdminRoomSummary } from "./adminMasterDetail";
import { calculateAdminWalletBalance } from "./adminOperations";
import { buildFinishedGameRecord, type GameRecord } from "./adminRecords";
import { getAdminDatabase } from "./firebaseAdmin";
import type { Room } from "./rooms";

export interface AdminAuditEntry {
  type: "economy_updated" | "wallet_granted" | "wallet_recovered";
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
  participantId?: string;
  at: number;
}

export interface AdminWalletLedgerEntry {
  id: string;
  type: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  createdAt: number;
  reason: string;
  administrator: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  walletLedger: AdminWalletLedgerEntry[];
  chatLogs: AdminChatLog[];
  gameRecords: GameRecord[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeBalance(value: unknown): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

function limitResults(value: number | undefined, fallback = 100, maximum = 200) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(1, Math.min(value as number, maximum));
}

function toAdminUserSummary(userId: string, rawProfile: unknown): AdminUserSummary {
  const profile = asRecord(rawProfile);
  const wallet = asRecord(profile.wallet);
  return {
    userId,
    nickname: typeof profile.nickname === "string" ? profile.nickname : "",
    coin: normalizeBalance(wallet.coin),
    money: normalizeBalance(wallet.money),
    games: asRecord(profile.games),
  };
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
  let recoveryBelowZero = false;
  const result = await profileRef.transaction((current) => {
    const profile = asRecord(current);
    const wallet = asRecord(profile.wallet);
    const previous = normalizeBalance(wallet[input.currency]);
    try {
      balanceAfter = calculateAdminWalletBalance(previous, input.amount);
      recoveryBelowZero = false;
    } catch {
      recoveryBelowZero = true;
      return;
    }
    return {
      ...profile,
      wallet: {
        coin: normalizeBalance(wallet.coin),
        money: normalizeBalance(wallet.money),
        [input.currency]: balanceAfter,
      },
    };
  });
  if (!result.committed) {
    if (recoveryBelowZero) throw new Error("잔액을 0 미만으로 회수할 수 없습니다.");
    throw new Error("지갑 지급 처리에 실패했습니다.");
  }

  const ledgerKey = pushKey(`walletLedger/${input.userId}`);
  const auditKey = pushKey("adminAuditLogs");
  await getAdminDatabase().ref().update({
    [`walletLedger/${input.userId}/${ledgerKey}`]: {
      type: input.amount < 0 ? "admin_recovery" : "admin_grant",
      currency: input.currency,
      amount: input.amount,
      balanceAfter,
      createdAt: now,
      reason: input.reason,
      administrator,
    },
    [`adminAuditLogs/${auditKey}`]: {
      type: input.amount < 0 ? "wallet_recovered" : "wallet_granted",
      administrator,
      createdAt: now,
      details: { ...input, balanceAfter },
    } satisfies AdminAuditEntry,
  });
  return { balanceAfter };
}

export async function listAdminUsers(query = "", limit?: number): Promise<AdminUserSummary[]> {
  const needle = query.trim().toLowerCase();
  const max = limitResults(limit, 1_000, 1_000);
  const snapshot = await getAdminDatabase().ref("profiles").once("value");
  const matches: AdminUserSummary[] = [];
  for (const [userId, rawProfile] of Object.entries(asRecord(snapshot.val()))) {
    const user = toAdminUserSummary(userId, rawProfile);
    if (needle && !user.userId.toLowerCase().includes(needle) && !user.nickname.toLowerCase().includes(needle)) continue;
    matches.push(user);
  }
  return matches
    .sort((left, right) => (left.nickname || left.userId).localeCompare(right.nickname || right.userId, "ko"))
    .slice(0, max);
}

export async function findAdminUsers(query: string, limit?: number): Promise<AdminUserSummary[]> {
  return listAdminUsers(query, limit ?? 50);
}

async function readAdminChatLogs(): Promise<AdminChatLog[]> {
  const snapshot = await getAdminDatabase().ref("chatLogs").once("value");
  const logs: AdminChatLog[] = [];
  for (const [storedRoomCode, rawMessages] of Object.entries(asRecord(snapshot.val()))) {
    for (const [id, rawMessage] of Object.entries(asRecord(rawMessages))) {
      const message = asRecord(rawMessage);
      const participantId = typeof message.participantId === "string" ? message.participantId : undefined;
      logs.push({
        id,
        roomCode: typeof message.roomCode === "string" ? message.roomCode : storedRoomCode,
        name: typeof message.name === "string" ? message.name : "",
        text: typeof message.text === "string" ? message.text : "",
        by: typeof message.by === "string" ? message.by : "unknown",
        ...(participantId ? { participantId } : {}),
        at: Number.isFinite(Number(message.at)) ? Number(message.at) : 0,
      });
    }
  }
  return logs;
}

export async function listAdminChatLogs(
  filters: { roomCode?: string; query?: string; userId?: string; limit?: number } = {},
): Promise<AdminChatLog[]> {
  const roomCode = filters.roomCode?.trim().toUpperCase();
  const query = filters.query?.trim().toLowerCase();
  const userId = filters.userId?.trim();
  return (await readAdminChatLogs())
    .filter((log) => !roomCode || log.roomCode === roomCode)
    .filter((log) => !userId || log.participantId === userId)
    .filter((log) => !query || log.name.toLowerCase().includes(query) || log.text.toLowerCase().includes(query))
    .sort((left, right) => right.at - left.at)
    .slice(0, limitResults(filters.limit));
}

export async function listAdminChatRooms(): Promise<AdminRoomSummary[]> {
  return summarizeChatRooms(await readAdminChatLogs());
}

async function readGameRecords(): Promise<GameRecord[]> {
  const snapshot = await getAdminDatabase().ref("gameLogs").once("value");
  return Object.values(asRecord(snapshot.val()))
    .filter((value): value is GameRecord => Boolean(value && typeof value === "object"))
    .sort((left, right) => right.finishedAt - left.finishedAt);
}

export async function listGameRecords(
  filters: { gameId?: string; roomCode?: string; userId?: string; limit?: number } = {},
): Promise<GameRecord[]> {
  const requestedGameId = filters.gameId?.trim();
  const requestedRoomCode = filters.roomCode?.trim().toUpperCase();
  const requestedUserId = filters.userId?.trim();
  const records = (await readGameRecords())
    .filter((record) => !requestedGameId || record.gameId === requestedGameId)
    .filter((record) => !requestedRoomCode || record.roomCode === requestedRoomCode)
    .filter((record) => !requestedUserId || record.participants.some((participant) => participant.userId === requestedUserId));
  return records.slice(0, limitResults(filters.limit));
}

export async function listAdminGameRooms(): Promise<AdminRoomSummary[]> {
  return summarizeGameRooms(await readGameRecords());
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return null;
  const profileSnapshot = await getAdminDatabase().ref(`profiles/${normalizedUserId}`).once("value");
  if (!profileSnapshot.exists()) return null;

  const [ledgerSnapshot, chatLogs, gameRecords] = await Promise.all([
    getAdminDatabase().ref(`walletLedger/${normalizedUserId}`).once("value"),
    listAdminChatLogs({ userId: normalizedUserId, limit: 50 }),
    listGameRecords({ userId: normalizedUserId, limit: 50 }),
  ]);
  const walletLedger = Object.entries(asRecord(ledgerSnapshot.val()))
    .map(([id, value]): AdminWalletLedgerEntry => {
      const entry = asRecord(value);
      return {
        id,
        type: typeof entry.type === "string" ? entry.type : "unknown",
        currency: entry.currency === "money" ? "money" : "coin",
        amount: normalizeBalance(entry.amount),
        balanceAfter: normalizeBalance(entry.balanceAfter),
        createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : 0,
        reason: typeof entry.reason === "string" ? entry.reason : "",
        administrator: typeof entry.administrator === "string" ? entry.administrator : "",
      };
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 50);

  return {
    ...toAdminUserSummary(normalizedUserId, profileSnapshot.val()),
    walletLedger,
    chatLogs,
    gameRecords,
  };
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
