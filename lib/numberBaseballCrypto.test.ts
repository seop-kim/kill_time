import { describe, expect, it } from "vitest";
import { decryptNumberBaseballAnswer, encryptNumberBaseballAnswer } from "./numberBaseballCrypto";

describe("number baseball answer token", () => {
  it("round-trips the answer without exposing it in the stored token", () => {
    const token = encryptNumberBaseballAnswer("427", "test-secret");

    expect(token).not.toContain("427");
    expect(decryptNumberBaseballAnswer(token, "test-secret")).toBe("427");
  });

  it("rejects a token signed with a different secret", () => {
    const token = encryptNumberBaseballAnswer("427", "test-secret");

    expect(() => decryptNumberBaseballAnswer(token, "wrong-secret")).toThrow();
  });
});
