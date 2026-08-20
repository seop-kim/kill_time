import { describe, expect, it } from "vitest";
import {
  GIRIN_PROMPT_MAX_LENGTH,
  GIRIN_TURN_SECONDS,
  advanceGirinRound,
  createGirinPixel,
  createGirinGame,
  createGirinLinePixels,
  createGirinStrokePixels,
  finishGirinGameIfSolo,
  getGirinTurnToastMessage,
  getGirinRemainingSeconds,
  girinPixelKey,
  submitGirinAnswer,
  submitGirinPrompt,
  type GirinParticipant,
} from "./girin";

const participants: GirinParticipant[] = [
  { id: "u1", name: "One", role: "host", order: 0 },
  { id: "u2", name: "Two", role: "guest", order: 0 },
  { id: "u3", name: "Three", role: "spectator", order: 0 },
];

describe("내가 그린 기린 그림 game state", () => {
  it("represents a pixel by its row, column, and color", () => {
    expect(createGirinPixel(12, 34, "#e51c23")).toEqual({ row: 12, col: 34, color: "#e51c23" });
    expect(girinPixelKey(12, 34)).toBe("12-34");
  });

  it("fills every pixel between fast pointer positions", () => {
    expect(createGirinLinePixels(12, 34, 12, 39)).toEqual([
      { row: 12, col: 34 },
      { row: 12, col: 35 },
      { row: 12, col: 36 },
      { row: 12, col: 37 },
      { row: 12, col: 38 },
      { row: 12, col: 39 },
    ]);

    expect(createGirinLinePixels(10, 10, 13, 13)).toEqual([
      { row: 10, col: 10 },
      { row: 11, col: 11 },
      { row: 12, col: 12 },
      { row: 13, col: 13 },
    ]);
  });

  it("creates a continuous one-cell brush stroke from fast pointer positions", () => {
    expect(createGirinStrokePixels(12, 34, 12, 39, 1, "#e51c23")).toEqual([
      { row: 12, col: 34, color: "#e51c23" },
      { row: 12, col: 35, color: "#e51c23" },
      { row: 12, col: 36, color: "#e51c23" },
      { row: 12, col: 37, color: "#e51c23" },
      { row: 12, col: 38, color: "#e51c23" },
      { row: 12, col: 39, color: "#e51c23" },
    ]);
  });

  it("randomly assigns every participant a unique order at game start", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const ordered = Object.values(game.participants).map((participant) => participant.order).sort();

    expect(ordered).toEqual([1, 2, 3]);
    expect(game.status).toBe("prompting");
    expect(game.currentRound).toBe(1);
    expect(game.currentParticipantId).toBeTruthy();
  });

  it("starts the five-minute drawing phase after an eight-character prompt", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const prompt = submitGirinPrompt(game, game.currentParticipantId, "기린그림", 2000);

    expect(prompt.status).toBe("drawing");
    expect(prompt.prompt).toBe("기린그림");
    expect(prompt.turnStartedAt).toBe(2000);
    expect(prompt.pixels).toEqual({});
    expect(GIRIN_PROMPT_MAX_LENGTH).toBe(8);
    expect(GIRIN_TURN_SECONDS).toBe(300);
  });

  it("calculates the Girin turn time remaining from the shared turn start", () => {
    expect(getGirinRemainingSeconds(1000, 1000)).toBe(300);
    expect(getGirinRemainingSeconds(1000, 61_000)).toBe(240);
    expect(getGirinRemainingSeconds(1000, 301_000)).toBe(0);
  });

  it("awards the quiz to an exact answerer and moves to the next questioner", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const drawing = submitGirinPrompt(game, game.currentParticipantId, "기린그림", 2000);
    const guesser = Object.keys(drawing.participants).find((id) => id !== drawing.currentParticipantId)!;

    expect(submitGirinAnswer(drawing, drawing.currentParticipantId, "기린그림").status).toBe("drawing");
    expect(submitGirinAnswer(drawing, guesser, "기린 그림").status).toBe("drawing");
    const next = submitGirinAnswer(drawing, guesser, "기린그림", 3000);
    expect(next.status).toBe("prompting");
    expect(next.currentRound).toBe(2);
    expect(next.lastRoundResult).toEqual({
      round: 1,
      drawerId: drawing.currentParticipantId,
      winnerId: guesser,
      outcome: "answered",
      completedAt: 3000,
    });
  });

  it("moves to the next numbered participant and ends after one full cycle", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const firstPrompt = submitGirinPrompt(game, game.currentParticipantId, "첫문제", 2000);
    const second = advanceGirinRound(firstPrompt, 303000);
    const secondPrompt = submitGirinPrompt(second, second.currentParticipantId, "둘째", 304000);
    const third = advanceGirinRound(secondPrompt, 605000);
    const thirdPrompt = submitGirinPrompt(third, third.currentParticipantId, "셋째", 606000);
    const finished = advanceGirinRound(thirdPrompt, 907000);

    expect(second.status).toBe("prompting");
    expect(second.currentRound).toBe(2);
    expect(finished.status).toBe("finished");
    expect(finished.winnerId).toBe(thirdPrompt.currentParticipantId);
    expect(finished.lastRoundResult?.outcome).toBe("stumped");
  });

  it("declares the questioner the quiz winner when five minutes pass without an answer", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const drawing = submitGirinPrompt(game, game.currentParticipantId, "기린", 2000);
    const next = advanceGirinRound(drawing, 302000);

    expect(next.status).toBe("prompting");
    expect(next.lastRoundResult?.winnerId).toBe(drawing.currentParticipantId);
    expect(next.lastRoundResult?.outcome).toBe("stumped");
  });

  it("finishes the game when fewer than two room participants remain", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const finished = finishGirinGameIfSolo(game, [game.currentParticipantId], 5000);

    expect(finished.status).toBe("finished");
    expect(finished.finishReason).toBe("participant_left");
    expect(finished.finishedAt).toBe(5000);
    expect(finished.turnStartedAt).toBeUndefined();
  });

  it("keeps the game active while at least two participants remain", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const participantIds = Object.keys(game.participants).slice(0, 2);

    expect(finishGirinGameIfSolo(game, participantIds)).toBe(game);
  });

  it("announces the first questioner when the game starts", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const questioner = game.participants[game.currentParticipantId];

    expect(getGirinTurnToastMessage(null, game)).toBe(
      `${questioner.order}번 ${questioner.name}님이 출제자입니다. 문제를 작성해 주세요.`,
    );
  });

  it("announces when the questioner submits a prompt and drawing begins", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const drawing = submitGirinPrompt(game, game.currentParticipantId, "기린", 2000);
    const questioner = drawing.participants[drawing.currentParticipantId];

    expect(getGirinTurnToastMessage(game, drawing)).toBe(
      `${questioner.order}번 ${questioner.name}님이 문제를 작성했습니다. 그림 그리기를 시작합니다.`,
    );
  });

  it("announces the next questioner when a round changes", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);
    const drawing = submitGirinPrompt(game, game.currentParticipantId, "기린", 2000);
    const next = advanceGirinRound(drawing, 302000);
    const questioner = next.participants[next.currentParticipantId];

    expect(getGirinTurnToastMessage(drawing, next)).toBe(
      `${questioner.order}번 ${questioner.name}님이 출제자입니다. 문제를 작성해 주세요.`,
    );
  });

  it("does not announce unchanged Girin state", () => {
    const game = createGirinGame(participants, 1000, () => 0.42);

    expect(getGirinTurnToastMessage(game, game)).toBeNull();
  });
});
