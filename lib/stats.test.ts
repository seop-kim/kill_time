import { describe, expect, it } from "vitest";
import {
  applyGameResult,
  applyGirinQuizResult,
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
