import { describe, expect, it } from "vitest";
import {
  applySeotdaAction,
  createSeotdaDeck,
  createSeotdaGame,
  evaluateSeotdaHand,
  expireSeotdaTurn,
  getLegalSeotdaActions,
  getSeotdaRemainingSeconds,
  getSeotdaPayouts,
  getSeotdaWinners,
  type SeotdaCard,
} from "./seotda";

const players = [
  { id: "p1", name: "하나", seat: 0 },
  { id: "p2", name: "둘", seat: 1 },
];

function card(value: number, isGwang = false, id = `${value}-${isGwang ? "g" : "n"}`): SeotdaCard {
  return { id, value, isGwang };
}

describe("Seotda deck and ranking", () => {
  it("creates the 20-card hwatu deck with only three gwang values", () => {
    const deck = createSeotdaDeck();

    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((item) => item.id)).size).toBe(20);
    expect(deck.filter((item) => item.isGwang).map((item) => item.value).sort()).toEqual([1, 3, 8]);
  });

  it("ranks gwangtta above ddaeng and ordinary kkeut", () => {
    expect(evaluateSeotdaHand([card(3, true), card(8, true)])).toMatchObject({ label: "38광땡", category: "gwangtta" });
    expect(evaluateSeotdaHand([card(10), card(10, false, "10-b")])).toMatchObject({ label: "10땡", category: "ddaeng" });
    expect(evaluateSeotdaHand([card(4), card(5)])).toMatchObject({ label: "9끗", category: "kkeut" });
  });
});

describe("Seotda game transitions", () => {
  it("deals one card to each player and starts on the first seat", () => {
    const game = createSeotdaGame(10_000, players, 100, () => 0.1);

    expect(game.status).toBe("betting");
    expect(game.round).toBe(1);
    expect(game.currentPlayerId).toBe("p1");
    expect(game.players.p1.hand).toHaveLength(1);
    expect(game.players.p2.hand).toHaveLength(1);
    expect(game.players.p1.stack).toBe(10_000);
  });

  it("rejects illegal actions and advances after a check", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);

    expect(() => applySeotdaAction(game, "p2", "check", 101)).toThrow("현재 차례");
    expect(getLegalSeotdaActions(game, "p1")).toEqual(expect.arrayContaining(["quarter", "half"]));
    const next = applySeotdaAction(game, "p1", "check", 101);

    expect(next.currentPlayerId).toBe("p2");
    expect(next.players.p1.acted).toBe(true);
    expect(getLegalSeotdaActions(next, "p2")).toContain("bet");
  });

  it("limits a betting turn to 30 seconds before automatically folding", () => {
    const game = createSeotdaGame(100, players, 1_000, () => 0.1);

    expect(getSeotdaRemainingSeconds(game.turnStartedAt, 30_999)).toBe(1);
    expect(expireSeotdaTurn(game, 30_999)).toBe(game);

    const timedOut = expireSeotdaTurn(game, 31_000);

    expect(getSeotdaRemainingSeconds(game.turnStartedAt, 31_000)).toBe(0);
    expect(timedOut.players.p1.folded).toBe(true);
    expect(timedOut.status).toBe("showdown");
    expect(timedOut.lastAction).toEqual({ playerId: "p1", action: "fold", amount: 0, round: 1, at: 31_000 });
  });

  it("keeps the first player's actions available when the turn comes back", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstCheck = applySeotdaAction(game, "p1", "check", 101);
    const afterOpponentBet = applySeotdaAction(afterFirstCheck, "p2", "bet", 102);

    expect(afterOpponentBet.currentPlayerId).toBe("p1");
    expect(getLegalSeotdaActions(afterOpponentBet, "p1")).toEqual(
      expect.arrayContaining(["call", "fold"]),
    );
  });

  it("scales quarter and half bets from the stake and growing pot", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterQuarter = applySeotdaAction(game, "p1", "quarter", 101);
    const afterHalf = applySeotdaAction(afterQuarter, "p2", "half", 102);

    expect(afterQuarter.players.p1.committed).toBe(25);
    expect(afterQuarter.pot).toBe(25);
    expect(afterHalf.players.p2.committed).toBe(75);
    expect(afterHalf.pot).toBe(100);
    expect(afterHalf.currentBet).toBe(75);
  });

  it("records the actor, action, and committed amount for the latest turn", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterQuarter = applySeotdaAction(game, "p1", "quarter", 101);

    expect(afterQuarter.lastAction).toEqual({
      playerId: "p1",
      action: "quarter",
      amount: 25,
      round: 1,
      at: 101,
    });
  });

  it("deals the second card after the first betting round completes", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterP1 = applySeotdaAction(game, "p1", "check", 101);
    const afterRound = applySeotdaAction(afterP1, "p2", "check", 102);

    expect(afterRound.round).toBe(2);
    expect(afterRound.status).toBe("betting");
    expect(afterRound.players.p1.hand).toHaveLength(2);
    expect(afterRound.players.p2.hand).toHaveLength(2);
    expect(afterRound.currentPlayerId).toBe("p1");
  });

  it("continues betting after a matched call while both players have money left", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "check", 101),
      "p2",
      "check",
      102,
    );
    const afterBet = applySeotdaAction(afterFirstRound, "p1", "bet", 103);
    const afterCall = applySeotdaAction(afterBet, "p2", "call", 104);

    expect(afterCall.status).toBe("betting");
    expect(afterCall.round).toBe(3);
    expect(afterCall.currentPlayerId).toBe("p1");
    expect(getLegalSeotdaActions(afterCall, "p1")).toContain("bet");
  });

  it("opens another betting cycle when both players check after a matched call", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "check", 101),
      "p2",
      "check",
      102,
    );
    const afterCall = applySeotdaAction(
      applySeotdaAction(afterFirstRound, "p1", "bet", 103),
      "p2",
      "call",
      104,
    );
    const afterChecks = applySeotdaAction(
      applySeotdaAction(afterCall, "p1", "check", 105),
      "p2",
      "check",
      106,
    );

    expect(afterChecks.status).toBe("betting");
    expect(afterChecks.round).toBe(4);
    expect(afterChecks.currentPlayerId).toBe("p1");
  });

  it("reveals the second cards before ending a matched all-in", () => {
    const baseGame = createSeotdaGame(100, players, 100, () => 0.1);
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        p2: { ...baseGame.players.p2, stack: 200 },
      },
    };
    const afterAllIn = applySeotdaAction(game, "p1", "all-in", 101);
    const afterCall = applySeotdaAction(afterAllIn, "p2", "call", 102);

    expect(afterCall.round).toBe(2);
    expect(afterCall.status).toBe("showdown");
    expect(afterCall.currentPlayerId).toBeNull();
    expect(afterCall.players.p1.hand).toHaveLength(2);
    expect(afterCall.players.p2.hand).toHaveLength(2);
  });

  it("moves a fold to showdown and gives the winner the loser's locked stake", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const folded = applySeotdaAction(game, "p1", "fold", 101);
    const winners = getSeotdaWinners(folded);
    const payouts = getSeotdaPayouts(folded);

    expect(folded.status).toBe("showdown");
    expect(winners).toEqual(["p2"]);
    expect(payouts.p1).toBe(0);
    expect(payouts.p2).toBe(200);
  });

  it("keeps checking players in the game until someone folds", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "check", 101),
      "p2",
      "check",
      102,
    );
    const afterSecondRound = applySeotdaAction(
      applySeotdaAction(afterFirstRound, "p1", "check", 103),
      "p2",
      "check",
      104,
    );
    const finished = applySeotdaAction(afterSecondRound, "p1", "fold", 105);

    expect(afterSecondRound.status).toBe("betting");
    expect(afterSecondRound.round).toBe(3);
    expect(finished.status).toBe("showdown");
    expect(getSeotdaPayouts(finished)).toEqual({ p1: 0, p2: 200 });
  });

  it("conserves the locked stake when the hand is tied", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const tied = {
      ...game,
      status: "showdown" as const,
      pot: 40,
      players: {
        ...game.players,
        p1: { ...game.players.p1, hand: [card(4), card(5)] as [SeotdaCard, SeotdaCard], committed: 20, stack: 80 },
        p2: { ...game.players.p2, hand: [card(2), card(7)] as [SeotdaCard, SeotdaCard], committed: 20, stack: 80 },
      },
    };

    const payouts = getSeotdaPayouts(tied);
    expect(payouts).toEqual({ p1: 100, p2: 100 });
  });
});
