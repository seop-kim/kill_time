import { get, onDisconnect, onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import { cellKey, type Board, type Stone } from "./gomoku";

export type PlayerRole = "host" | "guest";
export type ParticipantRole = PlayerRole | "spectator";

export interface Player {
  id?: string;
  name: string;
}

export interface Spectator {
  id: string;
  name: string;
}

export interface ChatMessage {
  by: ParticipantRole;
  name: string;
  text: string;
  at: number;
}

export interface Room {
  host: Player;
  guest: Player | null;
  spectators?: Record<string, Spectator>;
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
  presence?: { host?: boolean; guest?: boolean; spectators?: Record<string, boolean> };
}

export interface GameCandidate {
  id: string;
  name: string;
  role: "guest" | "spectator";
}

export const ROOM_CODE_LENGTH = 6;
export const TURN_SECONDS = 30;
export const DISCONNECT_GRACE_MS = 25000;

// no 0/O/1/I — easy to misread when typed in by hand
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateParticipantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export function getGameCandidates(room: Room): GameCandidate[] {
  const candidates: GameCandidate[] = [];
  if (room.guest) {
    candidates.push({ id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" });
  }
  for (const [id, spectator] of Object.entries(room.spectators ?? {})) {
    candidates.push({ id, name: spectator.name, role: "spectator" });
  }
  return candidates;
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
  | { ok: true; role: "guest"; participantId: string }
  | { ok: true; role: "spectator"; participantId: string }
  | { ok: false; reason: "not-found" | "full" };

export async function joinRoom(code: string, guestName: string): Promise<JoinResult> {
  const participantId = generateParticipantId();
  let result: JoinResult | null = null;
  const transaction = await runTransaction(roomRef(code), (currentRoom: Room | null) => {
    if (!currentRoom) return currentRoom;

    if (!currentRoom.guest) {
      currentRoom.guest = { id: participantId, name: guestName };
      currentRoom.status = "waiting";
      result = { ok: true, role: "guest", participantId };
    } else {
      currentRoom.spectators = currentRoom.spectators ?? {};
      currentRoom.spectators[participantId] = { id: participantId, name: guestName };
      result = { ok: true, role: "spectator", participantId };
    }
    return currentRoom;
  });

  if (!transaction.committed || !result) return { ok: false, reason: "not-found" };
  return result;
}

/** Only the player whose turn is next may request undoing the opponent's last move. */
export function canRequestUndo(
  room: Pick<Room, "status" | "lastMove" | "blackPlayer" | "turn">,
  role: PlayerRole,
): boolean {
  if (room.status !== "playing" || !room.lastMove) return false;
  const roleColor: Stone = room.blackPlayer === role ? "black" : "white";
  return room.turn === roleColor;
}

export async function startGame(code: string, candidateId: string): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room || room.status === "playing") return room;

    const candidate = getGameCandidates(room).find((item) => item.id === candidateId);
    if (!candidate) return room;

    if (candidate.role === "spectator") {
      const selected = room.spectators?.[candidate.id];
      if (!selected) return room;

      const spectators = room.spectators ?? {};
      if (room.guest) {
        const previousGuestId = room.guest.id ?? "guest";
        spectators[previousGuestId] = { id: previousGuestId, name: room.guest.name };
      }
      room.guest = { id: selected.id, name: selected.name };
      delete spectators[candidate.id];
      room.spectators = spectators;
    }

    if (room.board) delete room.board;
    room.turn = "black";
    room.status = "playing";
    room.winner = null;
    room.lastMove = null;
    room.turnStartedAt = Date.now();
    room.undoRequest = null;
    room.drawRequest = null;
    return room;
  });
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
  requesterRole: PlayerRole,
): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    if (!room.undoRequest || room.undoRequest !== requesterRole || !canRequestUndo(room, requesterRole)) return room;
    const lastMove = room.lastMove;
    if (!lastMove) return room;
    if (room.board) delete room.board[cellKey(lastMove.row, lastMove.col)];
    room.turn = room.turn === "black" ? "white" : "black";
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
    status: "waiting",
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
  msg: { by: ParticipantRole; name: string; text: string },
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
export function armPresence(code: string, role: ParticipantRole, participantId?: string): () => void {
  const db = getDb();
  if (role === "spectator" && !participantId) return () => {};
  const presenceRef =
    role === "spectator"
      ? ref(db, `rooms/${code}/presence/spectators/${participantId}`)
      : ref(db, `rooms/${code}/presence/${role}`);
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
