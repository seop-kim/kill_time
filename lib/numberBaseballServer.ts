import { getAdminSessionSecretFromEnv } from "./adminAuth";
import type { NumberBaseballPlayer } from "./numberBaseball";

type RoomParticipant = { id?: string; name?: string; userId?: string };
export type NumberBaseballRoomNode = {
  [key: string]: unknown;
  gameId?: string;
  status?: string;
  gameStartedAt?: number;
  turnStartedAt?: number;
  numberBaseballGame?: { status?: string };
  board?: unknown;
  seotdaGame?: unknown;
  girinGame?: unknown;
  minesweeperGame?: unknown;
  matchRequests?: unknown;
  gamePlayers?: unknown;
  host?: RoomParticipant;
  guest?: RoomParticipant | null;
  spectators?: Record<string, RoomParticipant>;
  presence?: { host?: boolean; guest?: boolean; spectators?: Record<string, boolean> };
};

function isOnline(room: NumberBaseballRoomNode, role: "host" | "guest" | "spectator", id?: string): boolean {
  if (role === "host") return room.presence?.host !== false;
  if (role === "guest") return room.presence?.guest !== false;
  return id ? room.presence?.spectators?.[id] !== false : false;
}

export function getNumberBaseballPlayers(room: NumberBaseballRoomNode): NumberBaseballPlayer[] {
  const players: NumberBaseballPlayer[] = [];
  if (room.host?.name && isOnline(room, "host")) {
    players.push({ id: room.host.id ?? "host", name: room.host.name, ...(room.host.userId ? { userId: room.host.userId } : {}) });
  }
  if (room.guest?.name && isOnline(room, "guest")) {
    players.push({ id: room.guest.id ?? "guest", name: room.guest.name, ...(room.guest.userId ? { userId: room.guest.userId } : {}) });
  }
  for (const [id, spectator] of Object.entries(room.spectators ?? {})) {
    if (spectator.name && isOnline(room, "spectator", id)) {
      players.push({ id, name: spectator.name, ...(spectator.userId ? { userId: spectator.userId } : {}) });
    }
  }
  return players;
}

export function normalizeNumberBaseballRoomCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function getNumberBaseballSecret(): string {
  return getAdminSessionSecretFromEnv() || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || "";
}

export function removeUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type NumberBaseballTransactionFailure = { message: string; status: number };

export function readNumberBaseballTransactionFailure(
  failure: NumberBaseballTransactionFailure | null,
): NumberBaseballTransactionFailure | null {
  return failure;
}
