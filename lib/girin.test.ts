import { describe, expect, it } from "vitest";
import {
  GIRIN_PROMPT_MAX_LENGTH,
  GIRIN_TURN_SECONDS,
  advanceGirinRound,
  createGirinGame,
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
    expect(GIRIN_PROMPT_MAX_LENGTH).toBe(8);
    expect(GIRIN_TURN_SECONDS).toBe(300);
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
});
