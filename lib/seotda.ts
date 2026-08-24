import { normalizeSeotdaStake } from "./economy";

export const SEOTDA_MAX_PLAYERS = 6;
export const SEOTDA_TURN_SECONDS = 30;

export type SeotdaStatus = "betting" | "showdown" | "finished";
export type SeotdaActionType = "bet" | "quarter" | "half" | "call" | "raise" | "all-in" | "fold";

export interface SeotdaCard {
  id: string;
  value: number;
  isGwang: boolean;
}

export interface SeotdaPlayerInput {
  id: string;
  name: string;
  seat: number;
  userId?: string;
  /** The player's own money brought into this match — their play stack, independent of the table's stake floor. */
  money: number;
}

export interface SeotdaRank {
  category: "gwangtta" | "ddaeng" | "special" | "kkeut";
  score: number;
  label: string;
}

export interface SeotdaPlayerState extends SeotdaPlayerInput {
  hand: SeotdaCard[];
  stack: number;
  committed: number;
  folded: boolean;
  acted: boolean;
}

export interface SeotdaLastAction {
  playerId: string;
  action: SeotdaActionType;
  amount: number;
  round: number;
  at: number;
}

export interface SeotdaGame {
  matchId: string;
  status: SeotdaStatus;
  /** Table entry floor and minBet basis — each player's actual play stack is their own money, see SeotdaPlayerState.stack. */
  stake: number;
  round: number;
  pot: number;
  currentBet: number;
  minBet: number;
  currentPlayerId: string | null;
  turnStartedAt: number;
  dealerId: string;
  winnerIds?: string[];
  lastAction?: SeotdaLastAction;
  deck: SeotdaCard[];
  players: Record<string, SeotdaPlayerState>;
}

export function getSeotdaRemainingSeconds(turnStartedAt: number, now = Date.now()): number {
  const elapsed = Math.max(0, Math.floor((now - turnStartedAt) / 1000));
  return Math.max(0, SEOTDA_TURN_SECONDS - elapsed);
}

const CARD_DEFINITIONS: Array<Pick<SeotdaCard, "value" | "isGwang">> = [
  { value: 1, isGwang: true },
  { value: 1, isGwang: false },
  { value: 2, isGwang: false },
  { value: 2, isGwang: false },
  { value: 3, isGwang: true },
  { value: 3, isGwang: false },
  { value: 4, isGwang: false },
  { value: 4, isGwang: false },
  { value: 5, isGwang: false },
  { value: 5, isGwang: false },
  { value: 6, isGwang: false },
  { value: 6, isGwang: false },
  { value: 7, isGwang: false },
  { value: 7, isGwang: false },
  { value: 8, isGwang: true },
  { value: 8, isGwang: false },
  { value: 9, isGwang: false },
  { value: 9, isGwang: false },
  { value: 10, isGwang: false },
  { value: 10, isGwang: false },
];

// Standard ranking: 알리 > 독사 > 구삥 > 장삥 > 세륙 > 장사.
const SPECIAL_HANDS: Record<string, { score: number; label: string }> = {
  "1,2": { score: 600, label: "알리" },
  "1,4": { score: 500, label: "독사" },
  "1,9": { score: 400, label: "구삥" },
  "1,10": { score: 300, label: "장삥" },
  "4,6": { score: 200, label: "세륙" },
  "4,10": { score: 100, label: "장사" },
};

function playerOrder(game: SeotdaGame): SeotdaPlayerState[] {
  return Object.values(game.players).sort((a, b) => a.seat - b.seat);
}

function activePlayers(game: SeotdaGame): SeotdaPlayerState[] {
  return playerOrder(game).filter((player) => !player.folded);
}

function cloneGame(game: SeotdaGame): SeotdaGame {
  return {
    ...game,
    deck: [...game.deck],
    players: Object.fromEntries(
      Object.entries(game.players).map(([id, player]) => [id, { ...player, hand: [...player.hand] }]),
    ),
  };
}

function nextActivePlayerId(game: SeotdaGame, fromId: string): string | null {
  const players = activePlayers(game);
  if (players.length === 0) return null;
  const index = players.findIndex((player) => player.id === fromId);
  for (let offset = 1; offset <= players.length; offset++) {
    const next = players[(index + offset + players.length) % players.length];
    if (!next.folded && (next.stack > 0 || !next.acted)) return next.id;
  }
  return null;
}

function firstBettingPlayerId(game: SeotdaGame): string | null {
  return activePlayers(game).find((player) => player.stack > 0)?.id ?? null;
}

function canContinueBetting(game: SeotdaGame): boolean {
  return activePlayers(game).filter((player) => player.stack > 0).length >= 2;
}

function isRoundComplete(game: SeotdaGame): boolean {
  const players = activePlayers(game);
  return players.length <= 1 || players.every((player) => player.acted && (player.committed === game.currentBet || player.stack === 0));
}

function dealSecondCards(game: SeotdaGame): void {
  for (const player of activePlayers(game)) {
    const card = game.deck.shift();
    if (card) player.hand.push(card);
  }
}

function finishBettingRound(game: SeotdaGame, now: number): void {
  if (activePlayers(game).length <= 1) {
    game.status = "showdown";
    game.currentPlayerId = null;
    return;
  }

  // Standard Seotda has exactly two betting rounds — one after the first
  // card, one after the second. Once round 2 settles, go straight to
  // showdown instead of opening a third round.
  if (game.round !== 1) {
    game.status = "showdown";
    game.currentPlayerId = null;
    return;
  }
  dealSecondCards(game);
  game.round += 1;
  if (!canContinueBetting(game)) {
    game.status = "showdown";
    game.currentPlayerId = null;
    return;
  }
  for (const player of Object.values(game.players)) player.acted = player.folded || player.stack === 0;
  const nextPlayerId = firstBettingPlayerId(game);
  if (!nextPlayerId) {
    game.status = "showdown";
    game.currentPlayerId = null;
    return;
  }
  game.currentPlayerId = nextPlayerId;
  game.turnStartedAt = now;
}

function advanceTurn(game: SeotdaGame, playerId: string, now: number): void {
  if (isRoundComplete(game)) {
    finishBettingRound(game, now);
    return;
  }
  game.currentPlayerId = nextActivePlayerId(game, playerId);
  game.turnStartedAt = now;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSeotdaDeck(): SeotdaCard[] {
  return CARD_DEFINITIONS.map((definition, index) => ({ ...definition, id: `${definition.value}-${index}` }));
}

export function createSeotdaGame(
  stake: number,
  players: SeotdaPlayerInput[],
  now = Date.now(),
  random = Math.random,
): SeotdaGame {
  const normalizedStake = normalizeSeotdaStake(stake);
  if (players.length < 2 || players.length > SEOTDA_MAX_PLAYERS) {
    throw new Error(`Up은 2명부터 ${SEOTDA_MAX_PLAYERS}명까지 참여할 수 있습니다.`);
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new Error("Up 참여자 ID가 중복되었습니다.");
  }

  const deck = shuffle(createSeotdaDeck(), random);
  const orderedPlayers = [...players].sort((a, b) => a.seat - b.seat);
  const playerStates = Object.fromEntries(
    orderedPlayers.map((player, index) => [
      player.id,
      { ...player, hand: [deck[index]], stack: Math.max(0, Math.floor(player.money)), committed: 0, folded: false, acted: false },
    ]),
  );

  return {
    matchId: `seotda-${now}-${Math.random().toString(36).slice(2, 8)}`,
    status: "betting",
    stake: normalizedStake,
    round: 1,
    pot: 0,
    currentBet: 0,
    minBet: Math.max(1, Math.ceil(normalizedStake / 10)),
    currentPlayerId: orderedPlayers[0].id,
    turnStartedAt: now,
    dealerId: orderedPlayers[0].id,
    deck: deck.slice(orderedPlayers.length),
    players: playerStates,
  };
}

export function evaluateSeotdaHand(hand: [SeotdaCard, SeotdaCard]): SeotdaRank {
  const values = hand.map((card) => card.value).sort((a, b) => a - b);
  if (hand.every((card) => card.isGwang) && values.join(",") === "3,8") {
    return { category: "gwangtta", score: 3_003, label: "38광땡" };
  }
  if (hand.every((card) => card.isGwang) && values.join(",") === "1,8") {
    return { category: "gwangtta", score: 3_002, label: "18광땡" };
  }
  if (hand.every((card) => card.isGwang) && values.join(",") === "1,3") {
    return { category: "gwangtta", score: 3_001, label: "13광땡" };
  }
  if (values[0] === values[1]) {
    return { category: "ddaeng", score: 2_000 + values[0], label: `${values[0]}땡` };
  }
  const special = SPECIAL_HANDS[values.join(",")];
  if (special) return { category: "special", score: 1_000 + special.score, label: special.label };
  const kkeut = (values[0] + values[1]) % 10;
  return { category: "kkeut", score: 100 + kkeut, label: `${kkeut}끗` };
}

// Standard Seotda quarter/half bets scale with the current pot, not the
// buy-in — minBet is only a floor so an empty early pot doesn't produce a
// zero-size bet.
function getFractionBetAmount(game: SeotdaGame, fraction: number): number {
  return Math.max(game.minBet, Math.ceil(game.pot * fraction));
}

export function getLegalSeotdaActions(game: SeotdaGame, playerId: string): SeotdaActionType[] {
  if (game.status !== "betting" || game.currentPlayerId !== playerId) return [];
  const player = game.players[playerId];
  if (!player || player.folded || player.stack <= 0) return [];

  const actions: SeotdaActionType[] = ["fold"];
  const toCall = Math.max(0, game.currentBet - player.committed);
  if (toCall === 0) {
    // Standard Seotda has no free "check" — the first actor in a round
    // either bets (at least minBet) or folds.
    if (player.stack >= game.minBet) actions.push("bet");
  } else if (player.stack >= toCall) {
    actions.push("call");
    if (player.stack >= toCall + game.minBet) actions.push("raise");
  }
  const quarterAmount = toCall + getFractionBetAmount(game, 0.25);
  const halfAmount = toCall + getFractionBetAmount(game, 0.5);
  if (player.stack >= quarterAmount) actions.push("quarter");
  if (player.stack >= halfAmount) actions.push("half");
  if (player.stack > 0 && (toCall === 0 || player.stack >= toCall)) actions.push("all-in");
  return actions;
}

export function applySeotdaAction(game: SeotdaGame, playerId: string, action: SeotdaActionType, now = Date.now()): SeotdaGame {
  const legalActions = getLegalSeotdaActions(game, playerId);
  if (!legalActions.includes(action)) {
    if (game.currentPlayerId !== playerId) throw new Error("현재 차례가 아닙니다.");
    throw new Error("현재 선택할 수 없는 베팅입니다.");
  }

  const next = cloneGame(game);
  const player = next.players[playerId];
  const toCall = Math.max(0, next.currentBet - player.committed);
  let committedAmount = 0;

  if (action === "fold") {
    player.folded = true;
    player.acted = true;
    next.lastAction = { playerId, action, amount: 0, round: next.round, at: now };
    advanceTurn(next, playerId, now);
    return next;
  }
  if (action === "bet") {
    committedAmount = next.minBet;
    player.acted = true;
  } else if (action === "call") {
    committedAmount = toCall;
    player.acted = true;
  } else if (action === "raise") {
    committedAmount = toCall + next.minBet;
    player.acted = true;
    for (const other of activePlayers(next)) {
      if (other.id !== playerId && other.stack > 0) other.acted = false;
    }
  } else if (action === "quarter" || action === "half") {
    committedAmount = toCall + getFractionBetAmount(next, action === "quarter" ? 0.25 : 0.5);
    player.acted = true;
    for (const other of activePlayers(next)) {
      if (other.id !== playerId && other.stack > 0) other.acted = false;
    }
  } else if (action === "all-in") {
    committedAmount = player.stack;
    player.acted = true;
    if (player.committed + committedAmount > next.currentBet) {
      next.currentBet = player.committed + committedAmount;
      for (const other of activePlayers(next)) {
        if (other.id !== playerId && other.stack > 0) other.acted = false;
      }
    }
  }

  if (committedAmount > 0) {
    player.stack -= committedAmount;
    player.committed += committedAmount;
    next.pot += committedAmount;
    next.currentBet = Math.max(next.currentBet, player.committed);
  }
  next.lastAction = { playerId, action, amount: committedAmount, round: next.round, at: now };
  advanceTurn(next, playerId, now);
  return next;
}

/** On timeout: call if a call is affordable, otherwise fold. */
export function expireSeotdaTurn(game: SeotdaGame, now = Date.now()): SeotdaGame {
  if (
    game.status !== "betting" ||
    !game.currentPlayerId ||
    getSeotdaRemainingSeconds(game.turnStartedAt, now) > 0
  ) {
    return game;
  }

  const legalActions = getLegalSeotdaActions(game, game.currentPlayerId);
  const action: SeotdaActionType = legalActions.includes("call") ? "call" : "fold";
  return applySeotdaAction(game, game.currentPlayerId, action, now);
}

export function getSeotdaWinners(game: SeotdaGame): string[] {
  const players = activePlayers(game);
  if (players.length <= 1) return players.map((player) => player.id);
  const ranked = players.map((player) => {
    if (player.hand.length !== 2) throw new Error("모든 생존 플레이어의 패가 공개되지 않았습니다.");
    return { id: player.id, rank: evaluateSeotdaHand(player.hand as [SeotdaCard, SeotdaCard]) };
  });
  const bestScore = Math.max(...ranked.map((item) => item.rank.score));
  return ranked.filter((item) => item.rank.score === bestScore).map((item) => item.id);
}

export function getSeotdaPayouts(game: SeotdaGame): Record<string, number> {
  // The wallet already locked each player's own money (SeotdaPlayerInput.money)
  // at match start. Every player gets back whatever they didn't bet (their
  // remaining stack) regardless of outcome; only the contested pot goes to
  // the winner(s), split evenly with any remainder handed out by seat order.
  const payouts = Object.fromEntries(Object.values(game.players).map((player) => [player.id, player.stack]));
  const winners = getSeotdaWinners(game);
  if (winners.length === 0) return payouts;

  const share = Math.floor(game.pot / winners.length);
  let remainder = game.pot % winners.length;
  for (const player of playerOrder(game)) {
    if (!winners.includes(player.id)) continue;
    payouts[player.id] += share;
    if (remainder > 0) {
      payouts[player.id] += 1;
      remainder -= 1;
    }
  }
  return payouts;
}
