import { describe, expect, it } from "vitest";
import {
  applyGameResult,
  applyGirinQuizResult,
  mergeGameResultIntoProfile,
  mergeGirinQuizResultIntoProfile,
  shouldAttemptStatsRecord,
  type UserStatsProfile,
} from "./stats";

function emptyProfile(): UserStatsProfile {
  return { nickname: "Player", games: {}, recordedGames: {} };
}

describe("applyGameResult", () => {
  it("keeps separate records for each game", () => {
    let profile = applyGameResult(emptyProfile(), "omok", "win", "room-1");
    profile = applyGameResult(profile, "baseball", "loss", "room-2");

    expect(profile.games.omok).toEqual({ played: 1, wins: 1, losses: 0, draws: 0 });
    expect(profile.games.baseball).toEqual({ played: 1, wins: 0, losses: 1, draws: 0 });
  });

  it("does not count the same finished game twice", () => {
    let profile = applyGameResult(emptyProfile(), "omok", "draw", "room-1");
    profile = applyGameResult(profile, "omok", "draw", "room-1");

    expect(profile.games.omok).toEqual({ played: 1, wins: 0, losses: 0, draws: 1 });
  });

  it("tracks total quizzes, correct answers, and stumped prompts for girin", () => {
    let profile = applyGirinQuizResult(emptyProfile(), "girin:room-1:1", {
      totalQuizzes: 1,
      correctAnswers: 1,
      stumped: 0,
    });
    profile = applyGirinQuizResult(profile, "girin:room-1:2", {
      totalQuizzes: 1,
      correctAnswers: 0,
      stumped: 1,
    });

    expect(profile.games.girin).toMatchObject({ totalQuizzes: 2, correctAnswers: 1, stumped: 1 });
  });

  it("does not count a girin quiz result twice", () => {
    let profile = applyGirinQuizResult(emptyProfile(), "girin:room-1:1", {
      totalQuizzes: 1,
      correctAnswers: 1,
      stumped: 0,
    });
    profile = applyGirinQuizResult(profile, "girin:room-1:1", {
      totalQuizzes: 1,
      correctAnswers: 1,
      stumped: 0,
    });

    expect(profile.games.girin).toMatchObject({ totalQuizzes: 1, correctAnswers: 1, stumped: 0 });
  });

  it("does not retry the same failed result on every room snapshot", () => {
    expect(shouldAttemptStatsRecord(null, "girin:room-1:1")).toBe(true);
    expect(shouldAttemptStatsRecord("girin:room-1:1", "girin:room-1:1")).toBe(false);
    expect(shouldAttemptStatsRecord("girin:room-1:1", "girin:room-1:2")).toBe(true);
  });
});

describe("merging a stats result into the raw profile record", () => {
  // A Firebase transaction return value replaces the whole node. Recording a
  // game result must not wipe sibling fields (wallet, walletSettlements,
  // attendance, ...) that applyGameResult/applyGirinQuizResult don't know
  // about — this reproduces a real bug where a winner's wallet was silently
  // erased by a racing stats-recording transaction right after settlement.
  it("preserves wallet and other unrelated fields when recording a game result", () => {
    const rawProfile = {
      nickname: "Player",
      games: {},
      recordedGames: {},
      wallet: { coin: 5, money: 230 },
      walletSettlements: { "seotda:match-1": { moneyDelta: 230 } },
    };

    const next = mergeGameResultIntoProfile(rawProfile, "seotda", "win", "room-1");

    expect(next.wallet).toEqual({ coin: 5, money: 230 });
    expect(next.walletSettlements).toEqual({ "seotda:match-1": { moneyDelta: 230 } });
    expect(next.games).toMatchObject({ seotda: { played: 1, wins: 1 } });
    expect(next.recordedGames).toEqual({ "room-1": "win" });
  });

  it("preserves wallet and other unrelated fields when recording a girin quiz result", () => {
    const rawProfile = {
      nickname: "Player",
      games: {},
      recordedGames: {},
      wallet: { coin: 5, money: 230 },
      attendance: { "2026-08-24": { claimedAt: 1 } },
    };

    const next = mergeGirinQuizResultIntoProfile(rawProfile, "girin:room-1:1", {
      totalQuizzes: 1,
      correctAnswers: 1,
      stumped: 0,
    });

    expect(next.wallet).toEqual({ coin: 5, money: 230 });
    expect(next.attendance).toEqual({ "2026-08-24": { claimedAt: 1 } });
    expect(next.games).toMatchObject({ girin: { totalQuizzes: 1, correctAnswers: 1 } });
  });

  it("handles a missing profile without throwing", () => {
    const next = mergeGameResultIntoProfile(null, "omok", "win", "room-1", "Player");
    expect(next.games).toMatchObject({ omok: { played: 1, wins: 1 } });
    expect(next.nickname).toBe("Player");
  });
});
