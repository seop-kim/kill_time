import { get, onDisconnect, onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import { canAffordSeotdaStake, normalizeSeotdaStake, SEOTDA_STAKE_MIN } from "./economy";
import { cellKey, type Board, type Stone } from "./gomoku";
import { finishGirinGameIfSolo, type GirinGame } from "./girin";
import {
  applySeotdaAction,
  createSeotdaGame,
  getSeotdaPayouts,
  getSeotdaWinners,
  SEOTDA_MAX_PLAYERS,
  type SeotdaActionType,
  type SeotdaGame,
} from "./seotda";
import { getWallet, lockSeotdaStake, settleSeotdaMatch } from "./wallet";

export type PlayerRole = "host" | "guest";
export type ParticipantRole = PlayerRole | "spectator";
export type RoomGameId = "omok" | "girin" | "seotda";

export interface Player {
  id?: string;
  userId?: string;
  name: string;
}

export const ROOM_HOME_PATH = "/workspace";

export function getRoomHostId(room: { host?: Player } | null | undefined): string | undefined {
  return room?.host ? room.host.id ?? "host" : undefined;
}

export interface Spectator {
  id: string;
  userId?: string;
  name: string;
}

export interface MatchParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  userId?: string;
}

export interface ChatMessage {
  by: ParticipantRole;
  participantId?: string;
  name: string;
  text: string;
  at: number;
}

export type ChatMessageInput = Omit<ChatMessage, "at">;

export interface ChatLogMessage extends ChatMessage {
  roomCode: string;
}

export function buildChatLogUpdates(
  code: string,
  messageKey: string,
  msg: ChatMessageInput,
  at: number,
): Record<string, ChatMessage | ChatLogMessage> {
  const message: ChatMessage = { ...msg, at };

  return {
    [`rooms/${code}/chat/${messageKey}`]: message,
    [`chatLogs/${code}/${messageKey}`]: { ...message, roomCode: code },
  };
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
  /** participants removed by the host while the room is waiting */
  kickedParticipants?: Record<string, { name: string; kickedAt: number }>;
  /** Reserved for money-stake games such as Seotda. */
  moneyStake?: number;
  seotdaGame?: SeotdaGame;
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
  if (value === "girin" || value === "seotda") return value;
  return "omok";
}

export function canEnterRoomWithWallet(
  room: Pick<Room, "gameId" | "moneyStake">,
  money: number,
): boolean {
  if (room.gameId !== "seotda") return true;
  return canAffordSeotdaStake(money, room.moneyStake ?? SEOTDA_STAKE_MIN);
}

export function applyRoomGameSelection(room: Room, gameId: RoomGameId): Room {
  return { ...room, gameId };
}

export function applyRoomGameSettings(
  room: Room,
  gameId: RoomGameId,
  moneyStake = room.moneyStake ?? SEOTDA_STAKE_MIN,
): Room {
  if (room.status === "playing") return room;

  if (gameId === "seotda") {
    return { ...room, gameId, moneyStake: normalizeSeotdaStake(moneyStake) };
  }

  const nextRoom = { ...room, gameId };
  delete nextRoom.moneyStake;
  return nextRoom;
}

export function resetSeotdaGame(room: Room): Room {
  if (room.gameId !== "seotda") return room;
  const nextRoom: Room = {
    ...room,
    status: "waiting",
    winner: null,
    lastMove: null,
    turnStartedAt: Date.now(),
  };
  delete nextRoom.seotdaGame;
  delete nextRoom.gameStartedAt;
  return nextRoom;
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
  const participants: MatchParticipant[] = [
    {
      id: room.host.id ?? "host",
      name: room.host.name,
      role: "host",
      ...(room.host.userId ? { userId: room.host.userId } : {}),
    },
  ];
  if (room.guest) {
    participants.push({
      id: room.guest.id ?? "guest",
      name: room.guest.name,
      role: "guest",
      ...(room.guest.userId ? { userId: room.guest.userId } : {}),
    });
  }
  for (const [id, spectator] of Object.entries(room.spectators ?? {})) {
    participants.push({ id, name: spectator.name, role: "spectator", ...(spectator.userId ? { userId: spectator.userId } : {}) });
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

export function getSeotdaParticipants(room: Room): MatchParticipant[] {
  return getMatchParticipants(room).slice(0, SEOTDA_MAX_PLAYERS);
}

export function isRoomFull(room: Room): boolean {
  return room.gameId === "seotda" && getMatchParticipants(room).length >= SEOTDA_MAX_PLAYERS;
}

export type SeotdaStartValidation =
  | { ok: true }
  | {
      ok: false;
      reason: "not-seotda" | "already-started" | "not-enough-players" | "too-many-players" | "insufficient-funds";
      missing?: Array<{ id: string; name: string; balance: number; required: number }>;
    };

export function validateSeotdaStart(room: Room, balances: Record<string, number>): SeotdaStartValidation {
  if (room.gameId !== "seotda") return { ok: false, reason: "not-seotda" };
  if (room.status !== "waiting" || room.seotdaGame) return { ok: false, reason: "already-started" };
  const participants = getMatchParticipants(room);
  if (participants.length < 2) return { ok: false, reason: "not-enough-players" };
  if (participants.length > SEOTDA_MAX_PLAYERS) return { ok: false, reason: "too-many-players" };

  const required = normalizeSeotdaStake(room.moneyStake ?? SEOTDA_STAKE_MIN);
  const missing = participants
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      balance: participant.userId ? Math.max(0, Math.floor(balances[participant.userId] ?? 0)) : 0,
      required,
    }))
    .filter((participant) => participant.balance < required);
  if (missing.length > 0) return { ok: false, reason: "insufficient-funds", missing };
  return { ok: true };
}

export type SeotdaStartResult =
  | { ok: true; matchId: string }
  | (SeotdaStartValidation & { ok: false });

export async function startSeotdaGame(code: string, now = Date.now()): Promise<SeotdaStartResult> {
  const snapshot = await get(roomRef(code));
  if (!snapshot.exists()) return { ok: false, reason: "already-started" };
  const room = snapshot.val() as Room;
  const participants = getMatchParticipants(room);
  const balances: Record<string, number> = {};
  await Promise.all(
    participants.map(async (participant) => {
      if (!participant.userId) return;
      balances[participant.userId] = (await getWallet(participant.userId)).money;
    }),
  );

  const validation = validateSeotdaStart(room, balances);
  if (!validation.ok) return validation;

  const stake = normalizeSeotdaStake(room.moneyStake ?? SEOTDA_STAKE_MIN);
  const game = createSeotdaGame(
    stake,
    getSeotdaParticipants(room).map((participant, seat) => ({
      id: participant.id,
      name: participant.name,
      seat,
      userId: participant.userId,
    })),
    now,
  );
  const lockedUserIds: string[] = [];
  try {
    for (const participant of getSeotdaParticipants(room)) {
      if (!participant.userId || !(await lockSeotdaStake(participant.userId, game.matchId, stake, now))) {
        throw new Error("섯다 판돈을 잠그지 못했습니다.");
      }
      lockedUserIds.push(participant.userId);
    }

    const transaction = await runTransaction(roomRef(code), (currentRoom: Room | null) => {
      if (!currentRoom || currentRoom.gameId !== "seotda" || currentRoom.status !== "waiting" || currentRoom.seotdaGame) return currentRoom;
      currentRoom.seotdaGame = game;
      currentRoom.status = "playing";
      currentRoom.gameStartedAt = now;
      return currentRoom;
    });
    if (!transaction.committed) throw new Error("섯다 게임 시작 상태를 저장하지 못했습니다.");
    return { ok: true, matchId: game.matchId };
  } catch (error) {
    await Promise.all(lockedUserIds.map((userId) => settleSeotdaMatch(userId, game.matchId, stake, now).catch(() => false)));
    throw error;
  }
}

export async function applySeotdaActionToRoom(
  code: string,
  playerId: string,
  action: SeotdaActionType,
  now = Date.now(),
): Promise<SeotdaGame> {
  let finishedGame: SeotdaGame | null = null;
  const transaction = await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room || room.gameId !== "seotda" || room.status !== "playing" || !room.seotdaGame) return room;
    const nextGame = applySeotdaAction(room.seotdaGame, playerId, action, now);
    if (nextGame.status === "showdown") {
      nextGame.winnerIds = getSeotdaWinners(nextGame);
      nextGame.status = "finished";
      room.status = "finished";
      finishedGame = nextGame;
    }
    room.seotdaGame = nextGame;
    return room;
  });

  if (!transaction.committed || !transaction.snapshot.exists()) throw new Error("섯다 베팅을 저장하지 못했습니다.");
  const nextRoom = transaction.snapshot.val() as Room;
  const nextGame = nextRoom.seotdaGame;
  if (!nextGame) throw new Error("섯다 게임 상태를 찾을 수 없습니다.");

  if (finishedGame) {
    const payouts = getSeotdaPayouts(nextGame);
    await Promise.all(
      Object.values(nextGame.players).map((player) =>
        player.userId ? settleSeotdaMatch(player.userId, nextGame.matchId, payouts[player.id] ?? 0, now) : Promise.resolve(false),
      ),
    );
  }
  return nextGame;
}

/**
 * Removes a participant at the host's request. Kicking is deliberately only
 * available while waiting: once a match starts, leaving is handled by the
 * game's forfeit/settlement rules instead of changing the roster mid-game.
 */
export function kickParticipantFromRoom(
  room: Room,
  requesterRole: ParticipantRole,
  target: MatchParticipant,
  now = Date.now(),
): Room {
  if (requesterRole !== "host" || room.status !== "waiting" || target.role === "host") return room;

  const current = getMatchParticipants(room).find((participant) => participant.id === target.id);
  if (!current || current.role !== target.role) return room;

  const nextRoom = removeParticipantFromRoom(room, target.role, target.id);
  return {
    ...nextRoom,
    kickedParticipants: {
      ...(room.kickedParticipants ?? {}),
      [target.id]: { name: current.name, kickedAt: now },
    },
  };
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
    ? { id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" as const, userId: room.guest.userId }
    : null;
  const onlineObserver = Object.entries(room.spectators ?? {})
    .find(([id]) => room.presence?.spectators?.[id] !== false);
  const candidate = onlineGuest ?? (onlineObserver
    ? { id: onlineObserver[0], name: onlineObserver[1].name, role: "spectator" as const, userId: onlineObserver[1].userId }
    : null);

  if (!candidate) return room;

  const nextRoom: Room = {
    ...room,
    host: { id: candidate.id, name: candidate.name, ...(candidate.userId ? { userId: candidate.userId } : {}) },
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
    return applyRoomGameSettings(room, gameId);
  });
}

export async function setRoomSettings(
  code: string,
  gameId: RoomGameId,
  moneyStake = SEOTDA_STAKE_MIN,
): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    return applyRoomGameSettings(room, gameId, moneyStake);
  });
}

export async function rematchSeotda(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room || room.gameId !== "seotda" || room.status !== "finished") return room;
    return resetSeotdaGame(room);
  });
}

export function finishSoloGirinInRoom(room: Room, now = Date.now()): Room {
  if (!room.girinGame) return room;

  const participantIds = getMatchParticipants(room).map((participant) => participant.id);
  const nextGirinGame = finishGirinGameIfSolo(room.girinGame, participantIds, now);
  if (nextGirinGame === room.girinGame) return room;
  return { ...room, girinGame: nextGirinGame };
}

export async function createRoom(
  hostName: string,
  gameId: RoomGameId = "omok",
  moneyStake = SEOTDA_STAKE_MIN,
  walletMoney = 0,
  userId?: string,
): Promise<string> {
  if (gameId === "seotda" && !canAffordSeotdaStake(walletMoney, moneyStake)) {
    throw new Error("섯다 판돈보다 머니가 부족합니다.");
  }
  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await get(roomRef(code));
    if (!snap.exists()) break;
    code = generateRoomCode();
  }

  const room: Room = {
    gameId,
    host: { id: "host", name: hostName, ...(userId ? { userId } : {}) },
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
  if (gameId === "seotda") room.moneyStake = normalizeSeotdaStake(moneyStake);
  await set(roomRef(code), room);
  return code;
}

export type JoinResult =
  | { ok: true; role: "guest"; participantId: string }
  | { ok: true; role: "spectator"; participantId: string }
  | { ok: false; reason: "not-found" | "full" | "insufficient-funds" };

export async function joinRoom(code: string, guestName: string, walletMoney = 0, userId?: string): Promise<JoinResult> {
  const participantId = generateParticipantId();
  let result: JoinResult | null = null;
  const transaction = await runTransaction(roomRef(code), (currentRoom: Room | null) => {
    if (!currentRoom) return currentRoom;

    if (!canEnterRoomWithWallet(currentRoom, walletMoney)) {
      result = { ok: false, reason: "insufficient-funds" };
      return currentRoom;
    }
    if (isRoomFull(currentRoom)) {
      result = { ok: false, reason: "full" };
      return currentRoom;
    }

    if (!currentRoom.guest) {
      currentRoom.guest = { id: participantId, name: guestName, ...(userId ? { userId } : {}) };
      currentRoom.status = "waiting";
      result = { ok: true, role: "guest", participantId };
    } else {
      currentRoom.spectators = currentRoom.spectators ?? {};
      currentRoom.spectators[participantId] = { id: participantId, name: guestName, ...(userId ? { userId } : {}) };
      result = { ok: true, role: "spectator", participantId };
    }
    return currentRoom;
  });

  if (result && "reason" in result) return result;
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
        spectators[previousGuestId] = { id: previousGuestId, name: room.guest.name, ...(room.guest.userId ? { userId: room.guest.userId } : {}) };
      }
      room.guest = { id: selected.id, name: selected.name, ...(selected.userId ? { userId: selected.userId } : {}) };
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
  msg: ChatMessageInput,
): Promise<void> {
  const db = getDb();
  const messageRef = push(ref(db, `rooms/${code}/chat`));
  if (!messageRef.key) throw new Error("채팅 메시지 키를 생성하지 못했습니다.");

  await update(ref(db), buildChatLogUpdates(code, messageRef.key, msg, Date.now()));
}

export async function kickParticipant(
  code: string,
  targetRole: Exclude<ParticipantRole, "host">,
  participantId: string,
): Promise<void> {
  await runTransaction(roomRef(code), (room: Room | null) => {
    if (!room) return room;
    const target = getMatchParticipants(room).find(
      (participant) => participant.id === participantId && participant.role === targetRole,
    );
    if (!target) return room;
    return kickParticipantFromRoom(room, "host", target);
  });
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
