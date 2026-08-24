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
  type SeotdaGame,
} from "./seotda";

const players = [
  { id: "p1", name: "하나", seat: 0, money: 100 },
  { id: "p2", name: "둘", seat: 1, money: 100 },
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

  it("ranks the six special hands in standard order: 알리 > 독사 > 구삥 > 장삥 > 세륙 > 장사", () => {
    const scores = {
      알리: evaluateSeotdaHand([card(1), card(2)]).score,
      독사: evaluateSeotdaHand([card(1), card(4)]).score,
      구삥: evaluateSeotdaHand([card(1), card(9)]).score,
      장삥: evaluateSeotdaHand([card(1), card(10)]).score,
      세륙: evaluateSeotdaHand([card(4), card(6)]).score,
      장사: evaluateSeotdaHand([card(4), card(10)]).score,
    };

    expect(scores.알리).toBeGreaterThan(scores.독사);
    expect(scores.독사).toBeGreaterThan(scores.구삥);
    expect(scores.구삥).toBeGreaterThan(scores.장삥);
    expect(scores.장삥).toBeGreaterThan(scores.세륙);
    expect(scores.세륙).toBeGreaterThan(scores.장사);
  });
});

describe("Seotda game transitions", () => {
  it("deals one card to each player and starts on the first seat", () => {
    const game = createSeotdaGame(
      10_000,
      [
        { id: "p1", name: "하나", seat: 0, money: 10_000 },
        { id: "p2", name: "둘", seat: 1, money: 10_000 },
      ],
      100,
      () => 0.1,
    );

    expect(game.status).toBe("betting");
    expect(game.round).toBe(1);
    expect(game.currentPlayerId).toBe("p1");
    expect(game.players.p1.hand).toHaveLength(1);
    expect(game.players.p2.hand).toHaveLength(1);
    expect(game.players.p1.stack).toBe(10_000);
  });

  it("uses each player's own money as their stack, independent of the table's stake floor", () => {
    const game = createSeotdaGame(
      10,
      [
        { id: "p1", name: "하나", seat: 0, money: 5_000 },
        { id: "p2", name: "둘", seat: 1, money: 3_000 },
      ],
      100,
      () => 0.1,
    );

    expect(game.stake).toBe(10);
    expect(game.minBet).toBe(1);
    expect(game.players.p1.stack).toBe(5_000);
    expect(game.players.p2.stack).toBe(3_000);

    // A single bet+call no longer wipes out the whole stack just because the
    // table's entry floor (stake) was set low — the stack is real money.
    const afterBet = applySeotdaAction(game, "p1", "bet", 101);
    const afterCall = applySeotdaAction(afterBet, "p2", "call", 102);

    expect(afterCall.status).toBe("betting");
    expect(afterCall.players.p1.stack).toBe(4_999);
    expect(afterCall.players.p2.stack).toBe(2_999);
  });

  it("rejects illegal actions and advances after an opening bet", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);

    expect(() => applySeotdaAction(game, "p2", "bet", 101)).toThrow("현재 차례");
    expect(getLegalSeotdaActions(game, "p1")).toEqual(expect.arrayContaining(["quarter", "half"]));
    expect(getLegalSeotdaActions(game, "p1")).not.toContain("check" as never);
    const next = applySeotdaAction(game, "p1", "bet", 101);

    expect(next.currentPlayerId).toBe("p2");
    expect(next.players.p1.acted).toBe(true);
    expect(getLegalSeotdaActions(next, "p2")).toContain("call");
  });

  it("folds on timeout when there is nothing to call yet (no free check)", () => {
    const game = createSeotdaGame(100, players, 1_000, () => 0.1);

    expect(getSeotdaRemainingSeconds(game.turnStartedAt, 30_999)).toBe(1);
    expect(expireSeotdaTurn(game, 30_999)).toBe(game);

    const timedOut = expireSeotdaTurn(game, 31_000);

    expect(getSeotdaRemainingSeconds(game.turnStartedAt, 31_000)).toBe(0);
    expect(timedOut.players.p1.folded).toBe(true);
    expect(timedOut.status).toBe("showdown");
    expect(timedOut.lastAction).toEqual({ playerId: "p1", action: "fold", amount: 0, round: 1, at: 31_000 });
  });

  it("calls on timeout when a call is affordable", () => {
    const game = createSeotdaGame(100, players, 1_000, () => 0.1);
    const afterBet = applySeotdaAction(game, "p1", "bet", 1_001);

    const timedOut = expireSeotdaTurn(afterBet, afterBet.turnStartedAt + 31_000);

    expect(timedOut.players.p2.folded).toBe(false);
    expect(timedOut.lastAction?.action).toBe("call");
    expect(timedOut.players.p2.committed).toBe(afterBet.currentBet);
  });

  it("folds on timeout when the player can't afford to call", () => {
    const baseGame = createSeotdaGame(1_000, players, 100, () => 0.1);
    const game: SeotdaGame = {
      ...baseGame,
      currentBet: 500,
      players: {
        ...baseGame.players,
        p1: { ...baseGame.players.p1, stack: 100 },
      },
    };

    const timedOut = expireSeotdaTurn(game, game.turnStartedAt + 31_000);

    expect(timedOut.players.p1.folded).toBe(true);
    expect(timedOut.lastAction?.action).toBe("fold");
  });

  it("keeps the first player's actions available when the turn comes back after a raise", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterBet = applySeotdaAction(game, "p1", "bet", 101);
    const afterRaise = applySeotdaAction(afterBet, "p2", "raise", 102);

    expect(afterRaise.currentPlayerId).toBe("p1");
    expect(getLegalSeotdaActions(afterRaise, "p1")).toEqual(
      expect.arrayContaining(["call", "fold"]),
    );
  });

  it("scales quarter and half bets from the current pot, falling back to minBet on an empty pot", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    // Pot is 0 before p1 acts, so "quarter" of the pot falls back to minBet (10).
    const afterQuarter = applySeotdaAction(game, "p1", "quarter", 101);
    // Pot is 10 once p1 has acted, so p2's "half" is toCall(10) + half of 10 (5) — but
    // that's below minBet, so it also falls back to minBet (10): 10 + 10 = 20.
    const afterHalf = applySeotdaAction(afterQuarter, "p2", "half", 102);

    expect(afterQuarter.players.p1.committed).toBe(10);
    expect(afterQuarter.pot).toBe(10);
    expect(afterHalf.players.p2.committed).toBe(20);
    expect(afterHalf.pot).toBe(30);
    expect(afterHalf.currentBet).toBe(20);
  });

  it("scales up once the pot is large enough for the fraction to exceed minBet", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterBet1 = applySeotdaAction(game, "p1", "bet", 101); // pot: 10
    const afterCall = applySeotdaAction(afterBet1, "p2", "call", 102); // pot: 20
    const afterBet2 = applySeotdaAction(afterCall, "p1", "bet", 103); // pot: 30
    const afterHalf = applySeotdaAction(afterBet2, "p2", "half", 104); // half of pot(30) = 15, +toCall(10) = 25

    expect(afterHalf.players.p2.committed).toBe(35);
  });

  it("records the actor, action, and committed amount for the latest turn", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterQuarter = applySeotdaAction(game, "p1", "quarter", 101);

    expect(afterQuarter.lastAction).toEqual({
      playerId: "p1",
      action: "quarter",
      amount: 10,
      round: 1,
      at: 101,
    });
  });

  it("does not deal a second card to a player who already folded", () => {
    const threePlayers = [
      { id: "p1", name: "하나", seat: 0, money: 100 },
      { id: "p2", name: "둘", seat: 1, money: 100 },
      { id: "p3", name: "셋", seat: 2, money: 100 },
    ];
    const game = createSeotdaGame(100, threePlayers, 100, () => 0.1);
    const afterFold = applySeotdaAction(game, "p1", "fold", 101);
    const afterP2 = applySeotdaAction(afterFold, "p2", "bet", 102);
    const afterRound = applySeotdaAction(afterP2, "p3", "call", 103);

    expect(afterRound.round).toBe(2);
    expect(afterRound.players.p1.hand).toHaveLength(1);
    expect(afterRound.players.p2.hand).toHaveLength(2);
    expect(afterRound.players.p3.hand).toHaveLength(2);
  });

  it("deals the second card after the first betting round completes", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterP1 = applySeotdaAction(game, "p1", "bet", 101);
    const afterRound = applySeotdaAction(afterP1, "p2", "call", 102);

    expect(afterRound.round).toBe(2);
    expect(afterRound.status).toBe("betting");
    expect(afterRound.players.p1.hand).toHaveLength(2);
    expect(afterRound.players.p2.hand).toHaveLength(2);
    expect(afterRound.currentPlayerId).toBe("p1");
  });

  it("moves to showdown once the second betting round settles", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "bet", 101),
      "p2",
      "call",
      102,
    );
    const afterSecondRound = applySeotdaAction(
      applySeotdaAction(afterFirstRound, "p1", "bet", 103),
      "p2",
      "call",
      104,
    );

    expect(afterFirstRound.status).toBe("betting");
    expect(afterFirstRound.round).toBe(2);
    expect(afterSecondRound.status).toBe("showdown");
    expect(afterSecondRound.round).toBe(2);
    expect(afterSecondRound.currentPlayerId).toBeNull();
  });

  it("never opens a third betting round, even after a raise exchange in round two", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "bet", 101),
      "p2",
      "call",
      102,
    );
    const afterRaise = applySeotdaAction(
      applySeotdaAction(afterFirstRound, "p1", "bet", 103),
      "p2",
      "raise",
      104,
    );
    const afterCall = applySeotdaAction(afterRaise, "p1", "call", 105);

    expect(afterCall.status).toBe("showdown");
    expect(afterCall.round).toBe(2);
    expect(afterCall.currentPlayerId).toBeNull();
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

  it("moves a fold to showdown and refunds both players when nothing was bet yet", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const folded = applySeotdaAction(game, "p1", "fold", 101);
    const winners = getSeotdaWinners(folded);
    const payouts = getSeotdaPayouts(folded);

    expect(folded.status).toBe("showdown");
    expect(winners).toEqual(["p2"]);
    // Nobody had committed anything before the fold, so there's no pot to
    // award — each player just gets their own untouched stake back.
    expect(payouts.p1).toBe(100);
    expect(payouts.p2).toBe(100);
  });

  it("gives the winner only the contested pot on top of their own refund, not the folder's whole stake", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterBet = applySeotdaAction(game, "p1", "bet", 101);
    const folded = applySeotdaAction(afterBet, "p2", "fold", 102);
    const payouts = getSeotdaPayouts(folded);

    expect(getSeotdaWinners(folded)).toEqual(["p1"]);
    // p1 bet 10 (minBet) into the pot and gets it back on top of their
    // remaining stack; p2 folded without betting, so they keep their full stake.
    expect(payouts.p1).toBe(100);
    expect(payouts.p2).toBe(100);
    expect(payouts.p1 + payouts.p2).toBe(200);
  });

  it("keeps matched players in the game into round two until someone folds", () => {
    const game = createSeotdaGame(100, players, 100, () => 0.1);
    const afterFirstRound = applySeotdaAction(
      applySeotdaAction(game, "p1", "bet", 101),
      "p2",
      "call",
      102,
    );
    const afterBet = applySeotdaAction(afterFirstRound, "p1", "bet", 103);
    const finished = applySeotdaAction(afterBet, "p2", "fold", 104);

    expect(afterFirstRound.status).toBe("betting");
    expect(afterFirstRound.round).toBe(2);
    expect(finished.status).toBe("showdown");
    // p1 bet 10 in round one (matched) and 10 more in round two before p2
    // folded without matching the second bet; p1 gets their own stack back
    // plus the whole pot (both round-one bets and their own round-two bet).
    expect(getSeotdaPayouts(finished)).toEqual({ p1: 110, p2: 90 });
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
