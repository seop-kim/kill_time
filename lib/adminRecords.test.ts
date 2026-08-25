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
});
