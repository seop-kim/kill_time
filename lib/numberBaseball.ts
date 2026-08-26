export const NUMBER_BASEBALL_MIN_PLAYERS = 2;
export const NUMBER_BASEBALL_MAX_PLAYERS = 3;
export const NUMBER_BASEBALL_DIGITS = 3;
export const NUMBER_BASEBALL_TURN_SECONDS = 30;
export const NUMBER_BASEBALL_MAX_ROUNDS = 5;

export type NumberBaseballStatus = "waiting" | "playing" | "finished";
export type NumberBaseballFinishReason = "correct" | "draw" | "player_left";

export interface NumberBaseballPlayer {
  id: string;
  name: string;
  userId?: string;
}

export interface NumberBaseballFeedback {
  strikes: number;
  balls: number;
  outs: number;
}

export interface NumberBaseballGuess {
  playerId: string;
  playerName: string;
  guess: string;
  feedback: NumberBaseballFeedback;
  round: number;
  at: number;
}

export interface NumberBaseballGame {
  status: NumberBaseballStatus;
  answerToken?: string;
  players: Record<string, NumberBaseballPlayer>;
  turnOrder: string[];
  currentPlayerId?: string;
  currentTurnIndex: number;
  round: number;
  maxRounds: number;
  turnSeconds: number;
  turnStartedAt?: number;
  guesses: NumberBaseballGuess[];
  lastGuess?: NumberBaseballGuess;
  winnerId?: string;
  finishReason?: NumberBaseballFinishReason;
  finishedAt?: number;
}

function assertThreeUniqueDigits(value: string): void {
  if (!/^\d{3}$/.test(value) || new Set(value).size !== NUMBER_BASEBALL_DIGITS) {
    throw new Error("숫자야구는 서로 다른 숫자 3개를 입력해야 합니다.");
  }
}

function takeRandom<T>(items: T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(Math.max(0, random()) * items.length));
  return items.splice(index, 1)[0];
}

export function createNumberBaseballTarget(random = Math.random): string {
  const firstDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const first = takeRandom(firstDigits, random);
  const remainingDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((digit) => digit !== first);
  return `${first}${takeRandom(remainingDigits, random)}${takeRandom(remainingDigits, random)}`;
}

export function randomizeNumberBaseballTurnOrder(playerIds: string[], random = Math.random): string[] {
  const order = [...playerIds];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(Math.max(0, random()) * (index + 1)));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

export function normalizeNumberBaseballGuess(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const guess = value.trim();
  if (!/^\d{3}$/.test(guess) || new Set(guess).size !== NUMBER_BASEBALL_DIGITS) return null;
  return guess;
}

export function evaluateNumberBaseballGuess(target: string, guess: string): NumberBaseballFeedback {
  assertThreeUniqueDigits(target);
  assertThreeUniqueDigits(guess);
  let strikes = 0;
  let balls = 0;
  for (let index = 0; index < NUMBER_BASEBALL_DIGITS; index += 1) {
    if (target[index] === guess[index]) strikes += 1;
    else if (target.includes(guess[index])) balls += 1;
  }
  return { strikes, balls, outs: NUMBER_BASEBALL_DIGITS - strikes - balls };
}

export function createNumberBaseballGame(
  players: NumberBaseballPlayer[],
  answerToken: string,
  now = Date.now(),
  random = Math.random,
): NumberBaseballGame {
  if (players.length < NUMBER_BASEBALL_MIN_PLAYERS || players.length > NUMBER_BASEBALL_MAX_PLAYERS) {
    throw new Error("숫자야구는 2명부터 3명까지 참여할 수 있습니다.");
  }
  const turnOrder = randomizeNumberBaseballTurnOrder(players.map((player) => player.id), random);
  return {
    status: "playing",
    answerToken,
    players: Object.fromEntries(players.map((player) => [player.id, player])),
    turnOrder,
    currentPlayerId: turnOrder[0],
    currentTurnIndex: 0,
    round: 1,
    maxRounds: NUMBER_BASEBALL_MAX_ROUNDS,
    turnSeconds: NUMBER_BASEBALL_TURN_SECONDS,
    turnStartedAt: now,
    guesses: [],
  };
}

export function applyNumberBaseballTurn(
  game: NumberBaseballGame,
  guess: NumberBaseballGuess,
): NumberBaseballGame {
  if (game.status !== "playing" || game.currentPlayerId !== guess.playerId) return game;

  const guesses = [...game.guesses, guess];
  const base = { ...game, guesses, lastGuess: guess };
  if (guess.feedback.strikes === NUMBER_BASEBALL_DIGITS) {
    return {
      ...base,
      status: "finished",
      winnerId: guess.playerId,
      finishReason: "correct",
      finishedAt: guess.at,
      turnStartedAt: undefined,
    };
  }

  const isLastPlayer = game.currentTurnIndex >= game.turnOrder.length - 1;
  if (isLastPlayer && game.round >= game.maxRounds) {
    return {
      ...base,
      status: "finished",
      finishReason: "draw",
      finishedAt: guess.at,
      currentPlayerId: undefined,
      turnStartedAt: undefined,
    };
  }

  const nextTurnIndex = isLastPlayer ? 0 : game.currentTurnIndex + 1;
  return {
    ...base,
    currentTurnIndex: nextTurnIndex,
    currentPlayerId: game.turnOrder[nextTurnIndex],
    round: isLastPlayer ? game.round + 1 : game.round,
    turnStartedAt: guess.at,
  };
}

export function advanceNumberBaseballTurn(game: NumberBaseballGame, now = Date.now()): NumberBaseballGame {
  if (game.status !== "playing" || !game.turnStartedAt || now - game.turnStartedAt < game.turnSeconds * 1_000) return game;
  const isLastPlayer = game.currentTurnIndex >= game.turnOrder.length - 1;
  if (isLastPlayer && game.round >= game.maxRounds) {
    return { ...game, status: "finished", finishReason: "draw", finishedAt: now, currentPlayerId: undefined, turnStartedAt: undefined };
  }
  const nextTurnIndex = isLastPlayer ? 0 : game.currentTurnIndex + 1;
  return {
    ...game,
    currentTurnIndex: nextTurnIndex,
    currentPlayerId: game.turnOrder[nextTurnIndex],
    round: isLastPlayer ? game.round + 1 : game.round,
    turnStartedAt: now,
  };
}

export function finishNumberBaseballGameIfSolo(
  game: NumberBaseballGame,
  remainingPlayerIds: string[],
  now = Date.now(),
): NumberBaseballGame {
  if (game.status !== "playing" || remainingPlayerIds.length > 1) return game;
  const winnerId = remainingPlayerIds[0] && game.players[remainingPlayerIds[0]] ? remainingPlayerIds[0] : undefined;
  const nextGame: NumberBaseballGame = {
    ...game,
    status: "finished",
    ...(winnerId ? { winnerId } : {}),
    finishReason: "player_left",
    finishedAt: now,
  };
  delete nextGame.currentPlayerId;
  delete nextGame.turnStartedAt;
  return nextGame;
}

export function removeNumberBaseballParticipant(
  game: NumberBaseballGame,
  participantId: string,
  now = Date.now(),
): NumberBaseballGame {
  if (game.status !== "playing" || !game.turnOrder.includes(participantId)) return game;
  const removedIndex = game.turnOrder.indexOf(participantId);
  const turnOrder = game.turnOrder.filter((id) => id !== participantId);
  const players = { ...game.players };
  delete players[participantId];
  const nextGame: NumberBaseballGame = { ...game, players, turnOrder };
  if (turnOrder.length <= 1) return finishNumberBaseballGameIfSolo(nextGame, turnOrder, now);

  if (game.currentPlayerId === participantId) {
    const nextRound = removedIndex === game.turnOrder.length - 1 ? game.round + 1 : game.round;
    if (nextRound > game.maxRounds) {
      delete nextGame.currentPlayerId;
      delete nextGame.turnStartedAt;
      return { ...nextGame, status: "finished", finishReason: "draw", finishedAt: now };
    }
    const nextTurnIndex = removedIndex >= turnOrder.length ? 0 : removedIndex;
    return {
      ...nextGame,
      currentTurnIndex: nextTurnIndex,
      currentPlayerId: turnOrder[nextTurnIndex],
      round: nextRound,
      turnStartedAt: now,
    };
  }

  return {
    ...nextGame,
    currentTurnIndex: removedIndex < game.currentTurnIndex ? game.currentTurnIndex - 1 : game.currentTurnIndex,
  };
}
