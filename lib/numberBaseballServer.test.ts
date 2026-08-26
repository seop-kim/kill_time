import { describe, expect, it } from "vitest";
import { getNumberBaseballPlayers, normalizeNumberBaseballRoomCode } from "./numberBaseballServer";

describe("number baseball server helpers", () => {
  it("collects up to three online room participants as players", () => {
    const players = getNumberBaseballPlayers({
      host: { id: "host", name: "Host", userId: "u-host" },
      guest: { id: "guest", name: "Guest" },
      spectators: {
        third: { id: "third", name: "Third" },
        offline: { id: "offline", name: "Offline" },
      },
      presence: { host: true, guest: true, spectators: { offline: false } },
    });

    expect(players.map((player) => player.id)).toEqual(["host", "guest", "third"]);
  });

  it("normalizes only six-character room codes", () => {
    expect(normalizeNumberBaseballRoomCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeNumberBaseballRoomCode("short")).toBeNull();
  });
});
