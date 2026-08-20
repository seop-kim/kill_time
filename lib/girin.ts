import { onValue, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import type { MatchParticipant, ParticipantRole } from "./rooms";

export const GIRIN_TURN_SECONDS = 300;
export const GIRIN_PROMPT_MAX_LENGTH = 8;
export const DEFAULT_GIRIN_PIXEL_COLOR = "#222";
export const GIRIN_PIXEL_COLUMNS = 256;
export const GIRIN_PIXEL_ROWS = 144;
export const GIRIN_PIXEL_SIZE = 5;

export interface GirinParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  order: number;
}

export interface GirinPixel {
  row: number;
  col: number;
  color: string | null;
}

export function createGirinPixel(row: number, col: number, color: string | null = DEFAULT_GIRIN_PIXEL_COLOR): GirinPixel {
  return { row, col, color };
}

export function girinPixelKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function createGirinLinePixels(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Array<{ row: number; col: number }> {
  const pixels: Array<{ row: number; col: number }> = [];
  const rowDistance = Math.abs(endRow - startRow);
  const colDistance = Math.abs(endCol - startCol);
  const rowStep = startRow < endRow ? 1 : -1;
  const colStep = startCol < endCol ? 1 : -1;
  let row = startRow;
  let col = startCol;
  let error = colDistance - rowDistance;

  while (true) {
    if (row >= 0 && row < GIRIN_PIXEL_ROWS && col >= 0 && col < GIRIN_PIXEL_COLUMNS) {
      pixels.push({ row, col });
    }
    if (row === endRow && col === endCol) break;

    const doubleError = error * 2;
    if (doubleError > -rowDistance) {
      error -= rowDistance;
      col += colStep;
    }
    if (doubleError < colDistance) {
      error += colDistance;
      row += rowStep;
    }
  }

  return pixels;
}

export function createGirinBrushPixels(
  row: number,
  col: number,
  brushSize: number,
  color: string | null,
): GirinPixel[] {
  const size = Math.max(1, Math.min(8, Math.round(brushSize)));
  const radius = Math.floor((size - 1) / 2);
  const pixels: GirinPixel[] = [];

  for (let pixelRow = row - radius; pixelRow < row - radius + size; pixelRow += 1) {
    for (let pixelCol = col - radius; pixelCol < col - radius + size; pixelCol += 1) {
      if (pixelRow < 0 || pixelRow >= GIRIN_PIXEL_ROWS || pixelCol < 0 || pixelCol >= GIRIN_PIXEL_COLUMNS) continue;
      pixels.push(createGirinPixel(pixelRow, pixelCol, color));
    }
  }

  return pixels;
}

export type GirinRoundOutcome = "answered" | "stumped";

export interface GirinRoundResult {
  round: number;
  drawerId: string;
  winnerId: string;
  outcome: GirinRoundOutcome;
  completedAt: number;
}

export type GirinStatus = "waiting" | "prompting" | "drawing" | "finished";
export type GirinFinishReason = "participant_left";

export interface GirinGame {
  status: GirinStatus;
  startedAt?: number;
  participants: Record<string, GirinParticipant>;
  currentParticipantId: string;
  currentRound: number;
  prompt?: string;
  turnStartedAt?: number;
  pixels?: Record<string, GirinPixel>;
  winnerId?: string;
  finishedAt?: number;
  finishReason?: GirinFinishReason;
  lastRoundResult?: GirinRoundResult;
}

function cloneGame(game: GirinGame): GirinGame {
  return {
    ...game,
    participants: { ...game.participants },
    pixels: { ...(game.pixels ?? {}) },
  };
}

function orderedParticipants(game: GirinGame): GirinParticipant[] {
  return Object.values(game.participants).sort((a, b) => a.order - b.order);
}

export function finishGirinGameIfSolo(
  game: GirinGame,
  participantIds: string[],
  now = Date.now(),
): GirinGame {
  if (game.status === "finished") return game;

  const remainingParticipants = participantIds.filter((participantId) => game.participants[participantId]);
  if (remainingParticipants.length >= 2) return game;

  const next = cloneGame(game);
  next.status = "finished";
  next.finishedAt = now;
  next.finishReason = "participant_left";
  delete next.turnStartedAt;
  return next;
}

export function getGirinTurnToastMessage(previous: GirinGame | null, current: GirinGame): string | null {
  const questioner = current.participants[current.currentParticipantId];
  if (!questioner) return null;

  const questionerLabel = `${questioner.order}번 ${questioner.name}`;
  const questionerChanged =
    !previous ||
    previous.status !== current.status ||
    previous.currentParticipantId !== current.currentParticipantId ||
    previous.currentRound !== current.currentRound;

  if (current.status === "prompting" && questionerChanged) {
    return `${questionerLabel}님이 출제자입니다. 문제를 작성해 주세요.`;
  }

  if (current.status === "drawing" && (!previous || previous.status !== "drawing" || previous.prompt !== current.prompt)) {
    return `${questionerLabel}님이 문제를 작성했습니다. 그림 그리기를 시작합니다.`;
  }

  return null;
}

export function createGirinGame(
  participants: GirinParticipant[],
  now = Date.now(),
  random: () => number = Math.random,
): GirinGame {
  if (participants.length < 2) throw new Error("내가 그린 기린 그림은 두 명 이상 필요합니다.");

  const shuffled = participants.map((participant) => ({ ...participant, order: 0 }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const ordered = shuffled.map((participant, index) => ({ ...participant, order: index + 1 }));
  return {
    status: "prompting",
    startedAt: now,
    participants: Object.fromEntries(ordered.map((participant) => [participant.id, participant])),
    currentParticipantId: ordered[0].id,
    currentRound: 1,
    pixels: {},
  };
}

export function submitGirinPrompt(
  game: GirinGame,
  participantId: string,
  prompt: string,
  now = Date.now(),
): GirinGame {
  const trimmedPrompt = prompt.trim();
  if (game.status !== "prompting" || game.currentParticipantId !== participantId) {
    throw new Error("현재 문제 출제자만 문제를 입력할 수 있습니다.");
  }
  if (!trimmedPrompt || Array.from(trimmedPrompt).length > GIRIN_PROMPT_MAX_LENGTH) {
    throw new Error(`문제는 1~${GIRIN_PROMPT_MAX_LENGTH}자로 입력해야 합니다.`);
  }

  const next = cloneGame(game);
  next.status = "drawing";
  next.prompt = trimmedPrompt;
  next.turnStartedAt = now;
  next.pixels = {};
  return next;
}

function completeGirinRound(
  game: GirinGame,
  winnerId: string,
  outcome: GirinRoundOutcome,
  completedAt: number,
): GirinGame {
  const ordered = orderedParticipants(game);
  const next = cloneGame(game);
  next.lastRoundResult = {
    round: game.currentRound,
    drawerId: game.currentParticipantId,
    winnerId,
    outcome,
    completedAt,
  };

  if (game.currentRound >= ordered.length) {
    next.status = "finished";
    next.winnerId = winnerId;
    next.finishedAt = completedAt;
    delete next.turnStartedAt;
    return next;
  }

  const nextParticipant = ordered[game.currentRound];
  next.status = "prompting";
  next.currentRound = game.currentRound + 1;
  next.currentParticipantId = nextParticipant.id;
  delete next.prompt;
  delete next.turnStartedAt;
  delete next.winnerId;
  next.pixels = {};
  return next;
}

export function submitGirinAnswer(
  game: GirinGame,
  participantId: string,
  answer: string,
  now = Date.now(),
): GirinGame {
  if (game.status !== "drawing" || participantId === game.currentParticipantId || answer !== game.prompt) return game;
  return completeGirinRound(game, participantId, "answered", now);
}

export function advanceGirinRound(game: GirinGame, now = Date.now()): GirinGame {
  if (game.status !== "drawing") return game;
  return completeGirinRound(game, game.currentParticipantId, "stumped", now);
}

function girinRef(code: string) {
  return ref(getDb(), `rooms/${code}/girinGame`);
}

export async function startGirinGame(code: string, participants: MatchParticipant[]): Promise<void> {
  await runTransaction(girinRef(code), (current) => {
    if (current && (current as GirinGame).status !== "finished") return current;
    return createGirinGame(
      participants.map((participant) => ({ ...participant, order: 0 })),
    );
  });
}

export async function resetGirinGame(code: string): Promise<void> {
  await update(ref(getDb(), `rooms/${code}`), { girinGame: null });
}

export async function submitGirinPromptToRoom(code: string, participantId: string, prompt: string): Promise<void> {
  await runTransaction(girinRef(code), (current) => {
    if (!current) return current;
    return submitGirinPrompt(current as GirinGame, participantId, prompt);
  });
}

export async function submitGirinAnswerToRoom(code: string, participantId: string, answer: string): Promise<void> {
  await runTransaction(girinRef(code), (current) => {
    if (!current) return current;
    return submitGirinAnswer(current as GirinGame, participantId, answer);
  });
}

export async function advanceGirinRoundInRoom(code: string): Promise<void> {
  await runTransaction(girinRef(code), (current) => {
    if (!current) return current;
    return advanceGirinRound(current as GirinGame);
  });
}

export async function addGirinPixel(code: string, pixel: GirinPixel): Promise<void> {
  const pixelRef = ref(getDb(), `rooms/${code}/girinGame/pixels/${girinPixelKey(pixel.row, pixel.col)}`);
  await set(pixelRef, pixel.color === null ? null : pixel);
}

export async function clearGirinPixels(code: string): Promise<void> {
  await set(ref(getDb(), `rooms/${code}/girinGame/pixels`), null);
}

export function subscribeGirinGame(code: string, callback: (game: GirinGame | null) => void): () => void {
  return onValue(girinRef(code), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as GirinGame) : null);
  });
}
