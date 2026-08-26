import { describe, expect, it } from "vitest";
import { buildFinishedGameRecord } from "./adminRecords";

describe("finished game archive", () => {
  it("creates a minimal completed Up record without leaking card details", () => {
    const record = buildFinishedGameRecord("UP1234", {
      gameId: "seotda",
      host: { id: "host-player", userId: "uuid-host", name: "방장" },
      guest: { id: "guest-player", userId: "uuid-guest", name: "참여자" },
      blackPlayer: "host",
      turn: "black",
      status: "finished",
      winner: null,
      lastMove: null,
      gameStartedAt: 1_700_000_000_000,
      seotdaGame: {
        matchId: "seotda-1700000000000-abcd12",
        status: "finished",
        stake: 1_000,
        round: 2,
        pot: 6_000,
        currentBet: 3_000,
        minBet: 100,
        currentPlayerId: null,
        turnStartedAt: 1_700_000_030_000,
        dealerId: "host-player",
        winnerIds: ["guest-player"],
        deck: [{ id: "hidden-card", value: 10, isGwang: false }],
        players: {
          "host-player": { id: "host-player", name: "방장", seat: 1, money: 10_000, stack: 7_000, committed: 3_000, folded: false, acted: true, hand: [{ id: "1", value: 1, isGwang: true }, { id: "2", value: 1, isGwang: false }] },
          "guest-player": { id: "guest-player", name: "참여자", seat: 2, money: 10_000, stack: 7_000, committed: 3_000, folded: false, acted: true, hand: [{ id: "3", value: 8, isGwang: true }, { id: "4", value: 3, isGwang: true }] },
        },
      },
    });

    expect(record).toEqual({
      id: "UP1234:seotda:seotda-1700000000000-abcd12",
      roomCode: "UP1234",
      gameId: "seotda",
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_030_000,
      participants: [
        { participantId: "host-player", userId: "uuid-host", name: "방장" },
        { participantId: "guest-player", userId: "uuid-guest", name: "참여자" },
      ],
      outcome: { winnerIds: ["guest-player"], pot: 6_000, rounds: 2 },
    });
  });

  it("returns null for an unfinished room", () => {
    expect(buildFinishedGameRecord("WAIT01", {
      host: { id: "host", name: "방장" },
      guest: null,
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    })).toBeNull();
  });

  it("archives a number baseball result without exposing the answer token", () => {
    const record = buildFinishedGameRecord("NB1234", {
      gameId: "numberBaseball",
      host: { id: "p1", userId: "u1", name: "하나" },
      guest: { id: "p2", userId: "u2", name: "둘" },
      spectators: { p3: { id: "p3", userId: "u3", name: "셋" } },
      blackPlayer: "host",
      turn: "black",
      status: "finished",
      winner: null,
      lastMove: null,
      gameStartedAt: 1_700_000_000_000,
      numberBaseballGame: {
        status: "finished",
        answerToken: "encrypted-answer",
        players: { p1: { id: "p1", name: "하나" }, p2: { id: "p2", name: "둘" }, p3: { id: "p3", name: "셋" } },
        turnOrder: ["p2", "p1", "p3"],
        currentTurnIndex: 1,
        round: 2,
        maxRounds: 5,
        turnSeconds: 30,
        guesses: [],
        winnerId: "p2",
        finishReason: "correct",
        finishedAt: 1_700_000_000_500,
      },
    });

    expect(record).toMatchObject({
      id: "NB1234:numberBaseball:1700000000000",
      gameId: "numberBaseball",
      participants: [{ participantId: "p1" }, { participantId: "p2" }, { participantId: "p3" }],
      outcome: { winnerIds: ["p2"], rounds: 2, reason: "correct" },
    });
    expect(JSON.stringify(record)).not.toContain("encrypted-answer");
  });
});
