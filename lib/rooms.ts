import { get, onDisconnect, onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import { cellKey, type Board, type Stone } from "./gomoku";

export type PlayerRole = "host" | "guest";

export interface Player {
  name: string;
}

export interface ChatMessage {
  by: PlayerRole;
  name: string;
  text: string;
  at: number;
}

export interface Room {
  host: Player;
  guest: Player | null;
  /** which role currently plays black; swaps on rematch */
  blackPlayer: PlayerRole;
  turn: Stone;
  status: "waiting" | "playing" | "finished";
  winner: Stone | "draw" | null;
  lastMove: { row: number; col: number } | null;
  board?: Board;
  /** client timestamp (ms) when the current turn began, drives the 30s timer */
  turnStartedAt?: number;
  undoRequest?: PlayerRole | null;
  drawRequest?: PlayerRole | null;
  presence?: { host?: boolean; guest?: boolean };
}

export const ROOM_CODE_LENGTH = 6;
export const TURN_SECONDS = 30;
export const DISCONNECT_GRACE_MS = 25000;

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
    turnStartedAt: Date.now(),
    undoRequest: null,
    drawRequest: null,
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
    turnStartedAt: Date.now(),
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
    turnStartedAt: Date.now(),
    undoRequest: null,
    drawRequest: null,
  });
}

/**
 * Turn skip on timeout. Transactional: RTDB retries this against fresh data
 * if a concurrent write (e.g. a real move landing at the same moment) beats
 * it, so the `room.turn !== expectedTurn` check always sees up-to-date state
 * and correctly no-ops instead of clobbering a move that just happened.
 */
export async function skipTurn(code: string, expectedTurn: Stone): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    if (room.status !== "playing" || room.turn !== expectedTurn) return room;
    room.turn = expectedTurn === "black" ? "white" : "black";
    room.turnStartedAt = Date.now();
    room.undoRequest = null;
    room.drawRequest = null;
    return room;
  });
}

/** No-ops if the room is no longer "playing" — avoids stomping a result that was already decided another way. */
export async function forfeit(code: string, winner: Stone): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    if (room.status !== "playing") return room;
    room.status = "finished";
    room.winner = winner;
    room.undoRequest = null;
    room.drawRequest = null;
    return room;
  });
}

export async function requestUndo(code: string, role: PlayerRole): Promise<void> {
  await update(roomRef(code), { undoRequest: role });
}

export async function cancelUndoRequest(code: string): Promise<void> {
  await update(roomRef(code), { undoRequest: null });
}

/** No-ops if the room is no longer "playing" — a pending request can otherwise be accepted after a forfeit/disconnect already ended the game. */
export async function acceptUndo(
  code: string,
  lastMove: { row: number; col: number },
  moverColor: Stone,
): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    if (room.status !== "playing") return room;
    if (room.board) delete room.board[cellKey(lastMove.row, lastMove.col)];
    room.turn = moverColor;
    room.lastMove = null;
    room.turnStartedAt = Date.now();
    room.undoRequest = null;
    return room;
  });
}

export async function requestDraw(code: string, role: PlayerRole): Promise<void> {
  await update(roomRef(code), { drawRequest: role });
}

export async function cancelDrawRequest(code: string): Promise<void> {
  await update(roomRef(code), { drawRequest: null });
}

/** No-ops if the room is no longer "playing" (see acceptUndo). */
export async function acceptDraw(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    if (room.status !== "playing") return room;
    room.status = "finished";
    room.winner = "draw";
    room.drawRequest = null;
    return room;
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
    turnStartedAt: Date.now(),
    undoRequest: null,
    drawRequest: null,
  });
}

export async function sendChatMessage(
  code: string,
  msg: { by: PlayerRole; name: string; text: string },
): Promise<void> {
  await push(ref(getDb(), `rooms/${code}/chat`), { ...msg, at: Date.now() });
}

export function subscribeChat(code: string, callback: (messages: ChatMessage[]) => void): () => void {
  return onValue(ref(getDb(), `rooms/${code}/chat`), (snap) => {
    const val = snap.val() as Record<string, ChatMessage> | null;
    const list = val ? Object.values(val).sort((a, b) => a.at - b.at) : [];
    callback(list);
  });
}

/**
 * Arms Firebase's disconnect-detection for this player: presence flips to
 * true once connected, and the server itself flips it to false if the
 * connection drops (covers closed tabs/lost network, not just clean unmount).
 * Returns a cleanup function for when this component unmounts normally.
 */
export function armPresence(code: string, role: PlayerRole): () => void {
  const db = getDb();
  const presenceRef = ref(db, `rooms/${code}/presence/${role}`);
  const unsubscribe = onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() === true) {
      onDisconnect(presenceRef)
        .set(false)
        .then(() => set(presenceRef, true));
    }
  });
  return () => {
    unsubscribe();
    set(presenceRef, false).catch(() => {});
  };
}
