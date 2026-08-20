import { describe, expect, it } from "vitest";
import {
  applyWalletDelta,
  buildSettlementId,
  normalizeWallet,
  shouldClaimAttendance,
  shouldSettleWallet,
} from "./wallet";

describe("wallet helpers", () => {
  it("normalizes missing and invalid balances to zero", () => {
    expect(normalizeWallet(null)).toEqual({ coin: 0, money: 0 });
    expect(normalizeWallet({ coin: "300", money: -50 })).toEqual({ coin: 300, money: 0 });
  });

  it("applies integer deltas without allowing a negative balance", () => {
    expect(applyWalletDelta({ coin: 300, money: 10_000 }, "coin", 200)).toEqual({ coin: 500, money: 10_000 });
    expect(() => applyWalletDelta({ coin: 100, money: 0 }, "coin", -101)).toThrow();
  });

  it("builds stable settlement IDs", () => {
    expect(buildSettlementId("omok", "AB12CD:1234")).toBe("omok:AB12CD:1234");
  });

  it("allows attendance and settlement only once", () => {
    expect(shouldClaimAttendance({}, "2026-08-20")).toBe(true);
    expect(shouldClaimAttendance({ "2026-08-20": { reward: 500 } }, "2026-08-20")).toBe(false);
    expect(shouldSettleWallet({}, "omok:room-1:1")).toBe(true);
    expect(shouldSettleWallet({ "omok:room-1:1": { coinDelta: 300 } }, "omok:room-1:1")).toBe(false);
  });
});
