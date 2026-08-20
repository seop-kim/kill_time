import { get, onDisconnect, onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import { cellKey, type Board, type Stone } from "./gomoku";
import { finishGirinGameIfSolo, type GirinGame } from "./girin";

export type PlayerRole = "host" | "guest";
export type ParticipantRole = PlayerRole | "spectator";
export type RoomGameId = "omok" | "girin";

export interface Player {
  id?: string;
  name: string;
}

export interface Spectator {
  id: string;
  name: string;
}

export interface MatchParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
}

export interface ChatMessage {
  by: ParticipantRole;
  participantId?: string;
  name: string;
  text: string;
  at: number;
}

export interface Room {
  /** The game selected for the entire room. Older rooms default to omok. */
  gameId?: RoomGameId;
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
  /** client timestamp (ms) when the current game session began */
  gameStartedAt?: number;
  /** participants who have raised their hand for the next match */
  matchRequests?: Record<string, MatchParticipant>;
  /** the two participants currently assigned to the game slots */
  gamePlayers?: { host: MatchParticipant; guest: MatchParticipant };
  girinGame?: GirinGame;
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
/** Time before a disconnected game is forfeited. */
export const DISCONNECT_GRACE_MS = 15000;
/** Time an offline guest or spectator remains in the room before removal. */
export const PARTICIPANT_REMOVAL_GRACE_MS = 20000;

export function normalizeRoomGameId(value: unknown): RoomGameId {
  return value === "girin" ? "girin" : "omok";
}

export function applyRoomGameSelection(room: Room, gameId: RoomGameId): Room {
  return { ...room, gameId };
}

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
  if (room.guest && room.presence?.guest !== false) {
    candidates.push({ id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" });
  }
  for (const [id, spectator] of Object.entries(room.spectators ?? {})) {
    if (room.presence?.spectators?.[id] === false) continue;
    candidates.push({ id, name: spectator.name, role: "spectator" });
  }
  return candidates;
}

export function getMatchParticipants(room: Room): MatchParticipant[] {
  const participants: MatchParticipant[] = [{ id: room.host.id ?? "host", name: room.host.name, role: "host" }];
  if (room.guest) participants.push({ id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" });
  for (const [id, spectator] of Object.entries(room.spectators ?? {})) {
    participants.push({ id, name: spectator.name, role: "spectator" });
  }

  return participants.filter((participant) => {
    if (participant.role === "host") return room.presence?.host !== false;
    if (participant.role === "guest") return room.presence?.guest !== false;
    return room.presence?.spectators?.[participant.id] !== false;
  });
}

function isParticipantOnline(room: Room, participant: MatchParticipant): boolean {
  return getMatchParticipants(room).some((current) => current.id === participant.id);
}

function initializeGame(room: Room, players: [MatchParticipant, MatchParticipant]) {
  const startedAt = Date.now();
  room.gamePlayers = { host: players[0], guest: players[1] };
  delete room.matchRequests;
  if (room.board) delete room.board;
  room.turn = "black";
  room.status = "playing";
  room.winner = null;
  room.lastMove = null;
  room.turnStartedAt = startedAt;
  room.gameStartedAt = startedAt;
  room.blackPlayer = "host";
  room.undoRequest = null;
  room.drawRequest = null;
}

export function applyMatchParticipation(
  room: Room,
  participant: MatchParticipant,
  participate: boolean,
): Room {
  if (room.status !== "waiting") return room;

  const nextRoom: Room = { ...room };
  const requests = { ...(room.matchRequests ?? {}) };
  if (participate) requests[participant.id] = participant;
  else delete requests[participant.id];

  if (Object.keys(requests).length > 0) nextRoom.matchRequests = requests;
  else delete nextRoom.matchRequests;

  const selected = Object.values(requests).filter((item) => isParticipantOnline(nextRoom, item));
  if (selected.length >= 2) initializeGame(nextRoom, [selected[0], selected[1]]);
  return nextRoom;
}

export function removeParticipantFromRoom(
  room: Room,
  role: ParticipantRole,
  participantId?: string,
): Room {
  const nextRoom: Room = { ...room };

  if (role === "guest") {
    if (participantId && room.guest?.id && room.guest.id !== participantId) return room;
    nextRoom.guest = null;
    if (room.presence) {
      nextRoom.presence = { ...room.presence };
      delete nextRoom.presence.guest;
    }
    if (room.matchRequests) {
      nextRoom.matchRequests = { ...room.matchRequests };
      delete nextRoom.matchRequests[participantId ?? "guest"];
      if (Object.keys(nextRoom.matchRequests).length === 0) delete nextRoom.matchRequests;
    }
    return nextRoom;
  }

  if (!participantId) return room;

  nextRoom.spectators = { ...(room.spectators ?? {}) };
  delete nextRoom.spectators[participantId];
  if (room.presence) {
    nextRoom.presence = { ...room.presence };
    nextRoom.presence.spectators = { ...(room.presence.spectators ?? {}) };
    delete nextRoom.presence.spectators[participantId];
  }
  if (room.matchRequests) {
    nextRoom.matchRequests = { ...room.matchRequests };
    delete nextRoom.matchRequests[participantId];
    if (Object.keys(nextRoom.matchRequests).length === 0) delete nextRoom.matchRequests;
  }
  return nextRoom;
}

/** Returns null when no room participant is still online. */
export function clearRoomIfEmpty(room: Room): Room | null {
  const hostOnline = room.presence?.host !== false;
  const guestOnline = Boolean(room.guest && room.presence?.guest !== false);
  const observerOnline = Object.entries(room.spectators ?? {}).some(
    ([id]) => room.presence?.spectators?.[id] !== false,
  );

  return hostOnline || guestOnline || observerOnline ? room : null;
}

export function transferOfflineHost(room: Room): Room {
  if (room.presence?.host !== false) return room;

  const onlineGuest = room.guest && room.presence?.guest !== false
    ? { id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" as const }
    : null;
  const onlineObserver = Object.entries(room.spectators ?? {})
    .find(([id]) => room.presence?.spectators?.[id] !== false);
  const candidate = onlineGuest ?? (onlineObserver
    ? { id: onlineObserver[0], name: onlineObserver[1].name, role: "spectator" as const }
    : null);

  if (!candidate) return room;

  const nextRoom: Room = {
    ...room,
    host: { id: candidate.id, name: candidate.name },
    presence: { ...(room.presence ?? {}), host: true },
  };
  if (room.spectators) nextRoom.spectators = { ...room.spectators };

  if (candidate.role === "guest") {
    nextRoom.guest = null;
    if (nextRoom.presence) delete nextRoom.presence.guest;
  } else {
    delete nextRoom.spectators?.[candidate.id];
    if (nextRoom.presence?.spectators) {
      nextRoom.presence.spectators = { ...nextRoom.presence.spectators };
      delete nextRoom.presence.spectators[candidate.id];
    }
  }

  if (room.matchRequests) {
    nextRoom.matchRequests = { ...room.matchRequests };
    delete nextRoom.matchRequests[candidate.id];
    delete nextRoom.matchRequests[room.host.id ?? "host"];
    if (Object.keys(nextRoom.matchRequests).length === 0) delete nextRoom.matchRequests;
  }

  return nextRoom;
}

function roomRef(code: string) {
  return ref(getDb(), `rooms/${code}`);
}

export async function setRoomGame(code: string, gameId: RoomGameId): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    return applyRoomGameSelection(room, gameId);
  });
}

export function finishSoloGirinInRoom(room: Room, now = Date.now()): Room {
  if (!room.girinGame) return room;

  const participantIds = getMatchParticipants(room).map((participant) => participant.id);
  const nextGirinGame = finishGirinGameIfSolo(room.girinGame, participantIds, now);
  if (nextGirinGame === room.girinGame) return room;
  return { ...room, girinGame: nextGirinGame };
}

export async function createRoom(hostName: string): Promise<string> {
  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await get(roomRef(code));
    if (!snap.exists()) break;
    code = generateRoomCode();
  }

  const room: Room = {
    gameId: "omok",
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

    initializeGame(room, [
      { id: "host", name: room.host.name, role: "host" },
      { id: candidate.id, name: candidate.name, role: candidate.role },
    ]);
    return room;
  });
}

export async function toggleMatchParticipation(
  code: string,
  participant: MatchParticipant,
  participate: boolean,
): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    return applyMatchParticipation(room, participant, participate);
  });
}

export async function leaveRoom(code: string, role: ParticipantRole, participantId?: string): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;

    let nextRoom: Room;
    if (role === "host") {
      const hostLeft = {
        ...room,
        presence: { ...(room.presence ?? {}), host: false },
      };
      nextRoom = transferOfflineHost(hostLeft);
    } else {
      nextRoom = removeParticipantFromRoom(room, role, participantId);
    }

    return clearRoomIfEmpty(finishSoloGirinInRoom(nextRoom));
  });
}

/** Returns an unsubscribe function. Calls back with null if the room doesn't exist. */
export function subscribeRoom(code: string, callback: (room: Room | null) => void): () => void {
  return onValue(roomRef(code), (snap) => {
    callback(snap.exists() ? (snap.val() as Room) : null);
  });
}

export async function transferOfflineHostInRoom(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    return clearRoomIfEmpty(finishSoloGirinInRoom(transferOfflineHost(room)));
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
  const startedAt = Date.now();
  await update(roomRef(code), {
    board: null,
    turn: "black",
    status: "waiting",
    winner: null,
    lastMove: null,
    blackPlayer: nextBlack,
    turnStartedAt: startedAt,
    gameStartedAt: startedAt,
    matchRequests: null,
    undoRequest: null,
    drawRequest: null,
  });
}

export async function sendChatMessage(
  code: string,
  msg: { by: ParticipantRole; participantId?: string; name: string; text: string },
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
