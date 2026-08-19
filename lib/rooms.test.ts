import { describe, expect, it } from "vitest";
import { canRequestUndo, getGameCandidates, type Room } from "./rooms";

describe("canRequestUndo", () => {
  it("allows the player whose turn it is to request undoing the opponent's last move", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { name: "Guest" },
      blackPlayer: "host",
      turn: "white",
      status: "playing",
      winner: null,
      lastMove: { row: 9, col: 9 },
    };

    expect(canRequestUndo(room, "guest")).toBe(true);
    expect(canRequestUndo(room, "host")).toBe(false);
  });

  it("does not allow undo before the game is playing or before any move exists", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { name: "Guest" },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(canRequestUndo(room, "host")).toBe(false);
  });

  it("lists the current guest and spectators as game-start candidates", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: {
        "spectator-1": { id: "spectator-1", name: "Observer" },
      },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(getGameCandidates(room)).toEqual([
      { id: "guest-1", name: "Guest", role: "guest" },
      { id: "spectator-1", name: "Observer", role: "spectator" },
    ]);
  });
});
