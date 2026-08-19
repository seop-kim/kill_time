import { describe, expect, it } from "vitest";
import { toggleChatOpen } from "./chat";

describe("chat state", () => {
  it("toggles the chat panel open and closed", () => {
    expect(toggleChatOpen(false)).toBe(true);
    expect(toggleChatOpen(true)).toBe(false);
  });
});
