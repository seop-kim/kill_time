import { onValue, ref, runTransaction } from "firebase/database";
import { getDb } from "./firebase";

export type GameResult = "win" | "loss" | "draw";
export type RecordedResult = GameResult | "quiz";

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  totalQuizzes?: number;
  correctAnswers?: number;
  stumped?: number;
}

export interface UserStatsProfile {
  nickname?: string;
  games: Record<string, GameStats>;
  /** Finished-game IDs make retries and page reloads idempotent. */
  recordedGames: Record<string, RecordedResult>;
}

const EMPTY_STATS: GameStats = { played: 0, wins: 0, losses: 0, draws: 0 };

export function shouldAttemptStatsRecord(lastAttemptedResultId: string | null, resultId: string): boolean {
  return lastAttemptedResultId !== resultId;
}

function normalizeStats(value: Partial<GameStats> | null | undefined): GameStats {
  const normalized: GameStats = {
    played: Number(value?.played) || 0,
    wins: Number(value?.wins) || 0,
    losses: Number(value?.losses) || 0,
    draws: Number(value?.draws) || 0,
  };
  if (value && ("totalQuizzes" in value || "correctAnswers" in value || "stumped" in value)) {
    normalized.totalQuizzes = Number(value.totalQuizzes) || 0;
    normalized.correctAnswers = Number(value.correctAnswers) || 0;
    normalized.stumped = Number(value.stumped) || 0;
  }
  return normalized;
}

export interface GirinQuizStatsDelta {
  totalQuizzes: number;
  correctAnswers: number;
  stumped: number;
}

export function normalizeUserStats(value: Partial<UserStatsProfile> | null | undefined): UserStatsProfile {
  const rawGames = value?.games ?? {};
  const games = Object.fromEntries(
    Object.entries(rawGames).map(([gameId, stats]) => [gameId, normalizeStats(stats)]),
  );
  return {
    ...(value?.nickname ? { nickname: value.nickname } : {}),
    games,
    recordedGames: { ...(value?.recordedGames ?? {}) },
  };
}

export function applyGameResult(
  profile: UserStatsProfile | null,
  gameId: string,
  result: GameResult,
  resultId: string,
  nickname?: string,
): UserStatsProfile {
  const next = normalizeUserStats(profile);
  if (nickname) next.nickname = nickname;
  if (next.recordedGames[resultId]) return next;

  const current = next.games[gameId] ?? EMPTY_STATS;
  const updated: GameStats = {
    ...current,
    played: current.played + 1,
  };
  if (result === "win") updated.wins += 1;
  if (result === "loss") updated.losses += 1;
  if (result === "draw") updated.draws += 1;

  next.games = { ...next.games, [gameId]: updated };
  next.recordedGames = { ...next.recordedGames, [resultId]: result };
  return next;
}

export function applyGirinQuizResult(
  profile: UserStatsProfile | null,
  resultId: string,
  delta: GirinQuizStatsDelta,
  nickname?: string,
): UserStatsProfile {
  const next = normalizeUserStats(profile);
  if (nickname) next.nickname = nickname;
  if (next.recordedGames[resultId]) return next;

  const current = next.games.girin ?? EMPTY_STATS;
  const totalQuizzes = (current.totalQuizzes ?? 0) + delta.totalQuizzes;
  const correctAnswers = (current.correctAnswers ?? 0) + delta.correctAnswers;
  const stumped = (current.stumped ?? 0) + delta.stumped;
  next.games = {
    ...next.games,
    girin: {
      ...current,
      played: totalQuizzes,
      wins: correctAnswers,
      losses: stumped,
      totalQuizzes,
      correctAnswers,
      stumped,
    },
  };
  next.recordedGames = { ...next.recordedGames, [resultId]: "quiz" };
  return next;
}

export async function recordGameResult(
  userId: string,
  nickname: string,
  gameId: string,
  result: GameResult,
  resultId: string,
): Promise<void> {
  await runTransaction(ref(getDb(), `profiles/${userId}`), (current) =>
    applyGameResult(current as UserStatsProfile | null, gameId, result, resultId, nickname),
  );
}

export async function recordGirinQuizResult(
  userId: string,
  nickname: string,
  resultId: string,
  delta: GirinQuizStatsDelta,
): Promise<void> {
  await runTransaction(ref(getDb(), `profiles/${userId}`), (current) =>
    applyGirinQuizResult(current as UserStatsProfile | null, resultId, delta, nickname),
  );
}

export function subscribeUserStats(
  userId: string,
  callback: (profile: UserStatsProfile) => void,
): () => void {
  return onValue(ref(getDb(), `profiles/${userId}`), (snapshot) => {
    callback(normalizeUserStats(snapshot.val() as UserStatsProfile | null));
  });
}
