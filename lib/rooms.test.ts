import { describe, expect, it } from "vitest";
import {
  canRequestUndo,
  DISCONNECT_GRACE_MS,
  applyMatchParticipation,
  getMatchParticipants,
  getGameCandidates,
  normalizeRoomGameId,
  applyRoomGameSelection,
  removeParticipantFromRoom,
  type Room,
} from "./rooms";

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

  it("excludes participants whose presence is offline", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: {
        "spectator-1": { id: "spectator-1", name: "Offline observer" },
        "spectator-2": { id: "spectator-2", name: "Online observer" },
      },
      presence: { guest: false, spectators: { "spectator-1": false, "spectator-2": true } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(getGameCandidates(room)).toEqual([
      { id: "spectator-2", name: "Online observer", role: "spectator" },
    ]);
  });

  it("removes a leaving guest or observer from the room", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: { "spectator-1": { id: "spectator-1", name: "Observer" } },
      presence: { guest: true, spectators: { "spectator-1": true } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const withoutGuest = removeParticipantFromRoom(room, "guest", "guest-1");
    expect(withoutGuest.guest).toBeNull();
    expect(withoutGuest.presence?.guest).toBeUndefined();

    const withoutObserver = removeParticipantFromRoom(room, "spectator", "spectator-1");
    expect(withoutObserver.spectators).toEqual({});
    expect(withoutObserver.presence?.spectators).toEqual({});
  });
});

describe("disconnect grace period", () => {
  it("ends a disconnected game after 15 seconds", () => {
    expect(DISCONNECT_GRACE_MS).toBe(15000);
  });
});

describe("match participation", () => {
  it("lists the host, guest, and online spectators as match participants", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: {
        "spectator-1": { id: "spectator-1", name: "Online observer" },
        "spectator-2": { id: "spectator-2", name: "Offline observer" },
      },
      presence: { host: true, guest: true, spectators: { "spectator-1": true, "spectator-2": false } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(getMatchParticipants(room)).toEqual([
      { id: "host", name: "Host", role: "host" },
      { id: "guest-1", name: "Guest", role: "guest" },
      { id: "spectator-1", name: "Online observer", role: "spectator" },
    ]);
  });

  it("starts a game automatically when the second participant raises their hand", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: { "spectator-1": { id: "spectator-1", name: "Observer" } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };
    const host = { id: "host", name: "Host", role: "host" as const };
    const guest = { id: "guest-1", name: "Guest", role: "guest" as const };

    const oneHand = applyMatchParticipation(room, host, true);
    expect(oneHand.status).toBe("waiting");
    expect(oneHand.matchRequests).toEqual({ host });

    const matched = applyMatchParticipation(oneHand, guest, true);
    expect(matched.status).toBe("playing");
    expect(matched.matchRequests).toBeUndefined();
    expect(matched.gamePlayers).toEqual({ host, guest });
    expect(matched.gameStartedAt).toEqual(matched.turnStartedAt);
  });
});

describe("room game selection", () => {
  it("keeps known room game ids and falls back to omok for old rooms", () => {
    expect(normalizeRoomGameId("girin")).toBe("girin");
    expect(normalizeRoomGameId("legacy-game")).toBe("omok");
    expect(normalizeRoomGameId(undefined)).toBe("omok");
  });

  it("changes the shared game selection without replacing room state", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const selected = applyRoomGameSelection(room, "girin");

    expect(selected.gameId).toBe("girin");
    expect(selected.host).toEqual(room.host);
    expect(selected.guest).toEqual(room.guest);
  });
});
