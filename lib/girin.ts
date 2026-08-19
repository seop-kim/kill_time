import { onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { getDb } from "./firebase";
import type { MatchParticipant, ParticipantRole } from "./rooms";

export const GIRIN_TURN_SECONDS = 300;
export const GIRIN_PROMPT_MAX_LENGTH = 8;

export interface GirinParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  order: number;
}

export interface GirinPoint {
  x: number;
  y: number;
}

export interface GirinStroke {
  points: GirinPoint[];
  color: string;
  width: number;
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

export interface GirinGame {
  status: GirinStatus;
  startedAt?: number;
  participants: Record<string, GirinParticipant>;
  currentParticipantId: string;
  currentRound: number;
  prompt?: string;
  turnStartedAt?: number;
  strokes: Record<string, GirinStroke>;
  winnerId?: string;
  finishedAt?: number;
  lastRoundResult?: GirinRoundResult;
}

function cloneGame(game: GirinGame): GirinGame {
  return {
    ...game,
    participants: { ...game.participants },
    strokes: { ...game.strokes },
  };
}

function orderedParticipants(game: GirinGame): GirinParticipant[] {
  return Object.values(game.participants).sort((a, b) => a.order - b.order);
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
    strokes: {},
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
  next.strokes = {};
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
  next.strokes = {};
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

export async function addGirinStroke(code: string, stroke: GirinStroke): Promise<void> {
  const strokeRef = push(ref(getDb(), `rooms/${code}/girinGame/strokes`));
  await set(strokeRef, stroke);
}

export function subscribeGirinGame(code: string, callback: (game: GirinGame | null) => void): () => void {
  return onValue(girinRef(code), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as GirinGame) : null);
  });
}
