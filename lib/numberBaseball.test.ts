import { describe, expect, it } from "vitest";
import {
  applyNumberBaseballTurn,
  createNumberBaseballTarget,
  evaluateNumberBaseballGuess,
  finishNumberBaseballGameIfSolo,
  removeNumberBaseballParticipant,
  type NumberBaseballGame,
} from "./numberBaseball";

function game(overrides: Partial<NumberBaseballGame> = {}): NumberBaseballGame {
  return {
    status: "playing",
    answerToken: "encrypted-answer",
    players: {
      a: { id: "a", name: "가" },
      b: { id: "b", name: "나" },
    },
    turnOrder: ["a", "b"],
    currentPlayerId: "a",
    currentTurnIndex: 0,
    round: 1,
    maxRounds: 2,
    turnSeconds: 30,
    turnStartedAt: 1_000,
    guesses: [],
    ...overrides,
  };
}

describe("number baseball rules", () => {
  it("creates a three-digit target with unique digits and no leading zero", () => {
    const randomValues = [0.99, 0, 0];
    const target = createNumberBaseballTarget(() => randomValues.shift() ?? 0);

    expect(target).toBe("901");
    expect(new Set(target).size).toBe(3);
    expect(target[0]).not.toBe("0");
  });

  it("counts strikes, balls, and outs for a valid guess", () => {
    expect(evaluateNumberBaseballGuess("427", "472")).toEqual({ strikes: 1, balls: 2, outs: 0 });
    expect(evaluateNumberBaseballGuess("427", "895")).toEqual({ strikes: 0, balls: 0, outs: 3 });
  });

  it("moves to the next player after a non-winning guess", () => {
    const next = applyNumberBaseballTurn(
      game(),
      { playerId: "a", playerName: "가", guess: "123", feedback: { strikes: 0, balls: 1, outs: 2 }, round: 1, at: 2_000 },
    );

    expect(next.currentPlayerId).toBe("b");
    expect(next.currentTurnIndex).toBe(1);
    expect(next.round).toBe(1);
    expect(next.guesses).toHaveLength(1);
    expect(next.status).toBe("playing");
  });

  it("finishes immediately when a player gets three strikes", () => {
    const next = applyNumberBaseballTurn(
      game(),
      { playerId: "a", playerName: "가", guess: "427", feedback: { strikes: 3, balls: 0, outs: 0 }, round: 1, at: 2_000 },
    );

    expect(next.status).toBe("finished");
    expect(next.winnerId).toBe("a");
    expect(next.finishReason).toBe("correct");
    expect(next.finishedAt).toBe(2_000);
  });

  it("finishes with a draw after the final player completes the final round", () => {
    const next = applyNumberBaseballTurn(
      game({ round: 2, currentPlayerId: "b", currentTurnIndex: 1 }),
      { playerId: "b", playerName: "나", guess: "123", feedback: { strikes: 0, balls: 0, outs: 3 }, round: 2, at: 2_000 },
    );

    expect(next.status).toBe("finished");
    expect(next.finishReason).toBe("draw");
    expect(next.winnerId).toBeUndefined();
  });

  it("ignores a guess from a player whose turn has not arrived", () => {
    const current = game();
    const next = applyNumberBaseballTurn(
      current,
      { playerId: "b", playerName: "나", guess: "123", feedback: { strikes: 0, balls: 0, outs: 3 }, round: 1, at: 2_000 },
    );

    expect(next).toEqual(current);
  });

  it("finishes when a player leaves and only one player remains", () => {
    const next = finishNumberBaseballGameIfSolo(game(), ["a"], 3_000);

    expect(next.status).toBe("finished");
    expect(next.winnerId).toBe("a");
    expect(next.finishReason).toBe("player_left");
  });

  it("removes a departed current player from the turn order", () => {
    const current = game({
      players: {
        a: { id: "a", name: "가" },
        b: { id: "b", name: "나" },
        c: { id: "c", name: "다" },
      },
      turnOrder: ["a", "b", "c"],
    });
    const next = removeNumberBaseballParticipant(current, "a", 3_000);

    expect(next.turnOrder).toEqual(["b", "c"]);
    expect(next.currentPlayerId).toBe("b");
    expect(next.players.a).toBeUndefined();
  });
});
