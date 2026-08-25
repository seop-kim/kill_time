import { describe, expect, it } from "vitest";
import { calculateAdminWalletBalance, parseAdminWalletGrant } from "./adminOperations";

describe("administrator wallet grants", () => {
  it("accepts a positive integer coin or money grant for a UUID user", () => {
    expect(parseAdminWalletGrant({
      userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6",
      currency: "money",
      amount: 10_000,
      reason: "이벤트 보상",
    })).toEqual({
      userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6",
      currency: "money",
      amount: 10_000,
      reason: "이벤트 보상",
    });
  });

  it("accepts a negative integer as an administrator wallet recovery", () => {
    expect(parseAdminWalletGrant({
      userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6",
      currency: "coin",
      amount: -250,
      reason: "운영 회수",
    })).toEqual({
      userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6",
      currency: "coin",
      amount: -250,
      reason: "운영 회수",
    });
  });

  it("allows an exact-balance recovery but rejects any recovery below zero", () => {
    expect(calculateAdminWalletBalance(250, -250)).toBe(0);
    expect(() => calculateAdminWalletBalance(250, -251)).toThrow("잔액을 0 미만으로 회수할 수 없습니다.");
  });

  it("rejects malformed targets, zero values, and oversized grant notes", () => {
    expect(parseAdminWalletGrant({ userId: "nickname", currency: "coin", amount: 10, reason: "보상" })).toBeNull();
    expect(parseAdminWalletGrant({ userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6", currency: "coin", amount: 0, reason: "보상" })).toBeNull();
    expect(parseAdminWalletGrant({ userId: "6f886b3d-9b1b-4027-abfe-8369f2dd22c6", currency: "coin", amount: 10, reason: "x".repeat(201) })).toBeNull();
  });
});
