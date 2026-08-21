import { describe, expect, it } from "vitest";
import {
  canRequestUndo,
  DISCONNECT_GRACE_MS,
  PARTICIPANT_REMOVAL_GRACE_MS,
  applyMatchParticipation,
  getSeotdaParticipants,
  isRoomFull,
  getMatchParticipants,
  getGameCandidates,
  normalizeRoomGameId,
  applyRoomGameSelection,
  applyRoomGameSettings,
  resetSeotdaGame,
  validateSeotdaStart,
  clearRoomIfEmpty,
  finishSoloGirinInRoom,
  buildChatLogUpdates,
  canEnterRoomWithWallet,
  getRoomHostId,
  removeParticipantFromRoom,
  kickParticipantFromRoom,
  ROOM_HOME_PATH,
  transferOfflineHost,
  type Room,
} from "./rooms";

describe("room exit safety", () => {
  it("handles a transient room snapshot without a host and exits to the workspace", () => {
    expect(getRoomHostId(undefined)).toBeUndefined();
    expect(getRoomHostId({})).toBeUndefined();
    expect(getRoomHostId({ host: { name: "방장" } })).toBe("host");
    expect(ROOM_HOME_PATH).toBe("/workspace");
  });
});

describe("Seotda room entry", () => {
  it("blocks entry when the wallet cannot cover the room stake", () => {
    expect(canEnterRoomWithWallet({ gameId: "seotda", moneyStake: 10_000 }, 9_999)).toBe(false);
    expect(canEnterRoomWithWallet({ gameId: "seotda", moneyStake: 10_000 }, 10_000)).toBe(true);
    expect(canEnterRoomWithWallet({ gameId: "omok" }, 0)).toBe(true);
  });
});

describe("Seotda room start validation", () => {
  it("treats every online Seotda participant as a player and checks all balances", () => {
    const room: Room = {
      gameId: "seotda",
      moneyStake: 10_000,
      host: { id: "host", userId: "u-host", name: "Host" },
      guest: { id: "guest", userId: "u-guest", name: "Guest" },
      spectators: { observer: { id: "observer", userId: "u-observer", name: "Observer" } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(getSeotdaParticipants(room)).toHaveLength(3);
    expect(isRoomFull(room)).toBe(false);
    expect(validateSeotdaStart(room, { "u-host": 10_000, "u-guest": 10_000, "u-observer": 9_999 })).toEqual({
      ok: false,
      reason: "insufficient-funds",
      missing: [{ id: "observer", name: "Observer", balance: 9_999, required: 10_000 }],
    });
  });

  it("caps Seotda rooms at six active players", () => {
    const room: Room = {
      gameId: "seotda",
      moneyStake: 1,
      host: { id: "host", name: "Host" },
      guest: { id: "guest", name: "Guest" },
      spectators: Object.fromEntries(Array.from({ length: 4 }, (_, index) => [`p${index}`, { id: `p${index}`, name: `P${index}` }])),
      status: "waiting",
      blackPlayer: "host",
      turn: "black",
      winner: null,
      lastMove: null,
    };

    expect(isRoomFull(room)).toBe(true);
  });

  it("returns a finished Seotda room to waiting without changing its stake", () => {
    const room: Room = {
      gameId: "seotda",
      moneyStake: 10_000,
      host: { name: "Host" },
      guest: { id: "guest", name: "Guest" },
      status: "finished",
      blackPlayer: "host",
      turn: "black",
      winner: null,
      lastMove: null,
      seotdaGame: { status: "finished" } as Room["seotdaGame"],
    };

    const reset = resetSeotdaGame(room);
    expect(reset.status).toBe("waiting");
    expect(reset.moneyStake).toBe(10_000);
    expect(reset.seotdaGame).toBeUndefined();
  });
});

describe("buildChatLogUpdates", () => {
  it("keeps the room chat entry and durable log entry in sync", () => {
    expect(
      buildChatLogUpdates(
        "AB12CD",
        "message-1",
        { by: "host", participantId: "user-1", name: "Host", text: "안녕하세요" },
        1234,
      ),
    ).toEqual({
      "rooms/AB12CD/chat/message-1": {
        by: "host",
        participantId: "user-1",
        name: "Host",
        text: "안녕하세요",
        at: 1234,
      },
      "chatLogs/AB12CD/message-1": {
        by: "host",
        participantId: "user-1",
        name: "Host",
        text: "안녕하세요",
        at: 1234,
        roomCode: "AB12CD",
      },
    });
  });
});

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

  it("promotes the online guest when the host leaves", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: { "spectator-1": { id: "spectator-1", name: "Observer" } },
      presence: { host: false, guest: true, spectators: { "spectator-1": true } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const promoted = transferOfflineHost(room);

    expect(promoted.host).toEqual({ id: "guest-1", name: "Guest" });
    expect(promoted.guest).toBeNull();
    expect(promoted.presence).toEqual({ host: true, spectators: { "spectator-1": true } });
    expect(promoted.matchRequests).toBeUndefined();
    expect(getMatchParticipants(promoted)[0]).toEqual({ id: "guest-1", name: "Guest", role: "host" });
  });

  it("promotes the first online observer when the guest is unavailable", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest-1", name: "Offline guest" },
      spectators: {
        "spectator-1": { id: "spectator-1", name: "First observer" },
        "spectator-2": { id: "spectator-2", name: "Second observer" },
      },
      presence: { host: false, guest: false, spectators: { "spectator-1": true, "spectator-2": false } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const promoted = transferOfflineHost(room);

    expect(promoted.host).toEqual({ id: "spectator-1", name: "First observer" });
    expect(promoted.spectators).toEqual({ "spectator-2": { id: "spectator-2", name: "Second observer" } });
    expect(promoted.presence?.host).toBe(true);
    expect(promoted.presence?.spectators).toEqual({ "spectator-2": false });
  });
});

describe("disconnect grace period", () => {
  it("keeps game forfeit at 15 seconds and removes offline participants after 20 seconds", () => {
    expect(DISCONNECT_GRACE_MS).toBe(15000);
    expect(PARTICIPANT_REMOVAL_GRACE_MS).toBe(20000);
  });
});

describe("host participant removal", () => {
  it("lets the host kick a waiting guest and removes that guest from match candidates", () => {
    const room: Room = {
      host: { id: "host-1", name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: { "spectator-1": { id: "spectator-1", name: "Observer" } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const kicked = kickParticipantFromRoom(
      room,
      "host",
      { id: "guest-1", name: "Guest", role: "guest" },
      1234,
    );

    expect(kicked.guest).toBeNull();
    expect(getMatchParticipants(kicked).map((participant) => participant.id)).toEqual(["host-1", "spectator-1"]);
    expect(kicked.kickedParticipants).toEqual({ "guest-1": { name: "Guest", kickedAt: 1234 } });
  });

  it("does not kick during a game or when requested by a non-host", () => {
    const room: Room = {
      host: { id: "host-1", name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      blackPlayer: "host",
      turn: "black",
      status: "playing",
      winner: null,
      lastMove: null,
    };
    const target = { id: "guest-1", name: "Guest", role: "guest" as const };

    expect(kickParticipantFromRoom(room, "host", target)).toBe(room);
    expect(kickParticipantFromRoom({ ...room, status: "waiting" }, "guest", target)).toEqual({ ...room, status: "waiting" });
  });
});

describe("room cleanup", () => {
  it("deletes the room when every participant is offline", () => {
    const room: Room = {
      host: { id: "host-1", name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      spectators: { "spectator-1": { id: "spectator-1", name: "Observer" } },
      presence: { host: false, guest: false, spectators: { "spectator-1": false } },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(clearRoomIfEmpty(room)).toBeNull();
  });

  it("keeps the room while at least one participant is online", () => {
    const room: Room = {
      host: { id: "host-1", name: "Host" },
      guest: { id: "guest-1", name: "Guest" },
      presence: { host: false, guest: true },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    expect(clearRoomIfEmpty(room)).toBe(room);
  });

  it("finishes a Girin game when room cleanup leaves one participant", () => {
    const room: Room = {
      host: { id: "host-1", name: "Host" },
      guest: null,
      presence: { host: true },
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
      girinGame: {
        status: "drawing",
        participants: {
          "host-1": { id: "host-1", name: "Host", role: "host", order: 1 },
          "guest-1": { id: "guest-1", name: "Guest", role: "guest", order: 2 },
        },
        currentParticipantId: "host-1",
        currentRound: 1,
        turnStartedAt: 1000,
      },
    };

    const updated = finishSoloGirinInRoom(room, 5000);

    expect(updated.girinGame?.status).toBe("finished");
    expect(updated.girinGame?.finishReason).toBe("participant_left");
    expect(updated.girinGame?.finishedAt).toBe(5000);
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
    expect(normalizeRoomGameId("seotda")).toBe("seotda");
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

  it("stores a validated Seotda stake in waiting-room settings", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: null,
      blackPlayer: "host",
      turn: "black",
      status: "waiting",
      winner: null,
      lastMove: null,
    };

    const selected = applyRoomGameSettings(room, "seotda", 50_000);

    expect(selected.gameId).toBe("seotda");
    expect(selected.moneyStake).toBe(50_000);
    expect(() => applyRoomGameSettings(room, "seotda", 0)).toThrow();
  });

  it("does not change the game or stake after a room starts playing", () => {
    const room: Room = {
      host: { name: "Host" },
      guest: { id: "guest", name: "Guest" },
      gameId: "seotda",
      moneyStake: 100,
      blackPlayer: "host",
      turn: "black",
      status: "playing",
      winner: null,
      lastMove: null,
    };

    expect(applyRoomGameSettings(room, "omok", 1_000)).toBe(room);
  });
});
