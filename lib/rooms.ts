import { get, onValue, ref, set, update } from "firebase/database";
import { getDb } from "./firebase";
import { cellKey, type Board, type Stone } from "./gomoku";

export type PlayerRole = "host" | "guest";

export interface Player {
  name: string;
}

export interface Room {
  host: Player;
  guest: Player | null;
  /** which role currently plays black; swaps on rematch */
  blackPlayer: PlayerRole;
  turn: Stone;
  status: "waiting" | "playing" | "finished";
  winner: Stone | null;
  lastMove: { row: number; col: number } | null;
  board?: Board;
}

export const ROOM_CODE_LENGTH = 6;
// no 0/O/1/I — easy to misread when typed in by hand
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

function roomRef(code: string) {
  return ref(getDb(), `rooms/${code}`);
}

export async function createRoom(hostName: string): Promise<string> {
  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await get(roomRef(code));
    if (!snap.exists()) break;
    code = generateRoomCode();
  }

  const room: Room = {
    host: { name: hostName },
    guest: null,
    blackPlayer: "host",
    turn: "black",
    status: "waiting",
    winner: null,
    lastMove: null,
  };
  await set(roomRef(code), room);
  return code;
}

export type JoinResult =
  | { ok: true; role: PlayerRole }
  | { ok: false; reason: "not-found" | "full" };

export async function joinRoom(code: string, guestName: string): Promise<JoinResult> {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return { ok: false, reason: "not-found" };

  const room = snap.val() as Room;
  if (room.guest) return { ok: false, reason: "full" };

  await update(roomRef(code), {
    guest: { name: guestName },
    status: "playing",
  });
  return { ok: true, role: "guest" };
}

/** Returns an unsubscribe function. Calls back with null if the room doesn't exist. */
export function subscribeRoom(code: string, callback: (room: Room | null) => void): () => void {
  return onValue(roomRef(code), (snap) => {
    callback(snap.exists() ? (snap.val() as Room) : null);
  });
}

export async function placeStone(
  code: string,
  params: {
    row: number;
    col: number;
    stone: Stone;
    nextTurn: Stone;
    status: "playing" | "finished";
    winner: Stone | null;
  },
): Promise<void> {
  await update(roomRef(code), {
    [`board/${cellKey(params.row, params.col)}`]: params.stone,
    lastMove: { row: params.row, col: params.col },
    turn: params.nextTurn,
    status: params.status,
    winner: params.winner,
  });
}

export async function rematch(code: string, currentBlackPlayer: PlayerRole): Promise<void> {
  const nextBlack: PlayerRole = currentBlackPlayer === "host" ? "guest" : "host";
  await update(roomRef(code), {
    board: null,
    turn: "black",
    status: "playing",
    winner: null,
    lastMove: null,
    blackPlayer: nextBlack,
  });
}
