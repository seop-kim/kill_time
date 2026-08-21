import { describe, expect, it } from "vitest";
import rulesConfig from "../database.rules.json";

describe("Realtime Database rules", () => {
  it("requires Firebase authentication for profile and room data", () => {
    expect(rulesConfig.rules.profiles["$userId"][".read"]).toBe("auth != null");
    expect(rulesConfig.rules.profiles["$userId"][".write"]).toBe("auth != null");
    expect(rulesConfig.rules.rooms["$roomCode"][".read"]).toBe("auth != null");
    expect(rulesConfig.rules.rooms["$roomCode"][".write"]).toBe("auth != null");
  });
});
