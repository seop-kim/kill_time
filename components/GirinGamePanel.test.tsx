import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGirinStroke } from "../lib/girin";
import { GirinGamePanel } from "./GirinGamePanel";
import type { GirinGame } from "../lib/girin";

const baseGame: GirinGame = {
  status: "prompting",
  startedAt: 1000,
  participants: {
    u1: { id: "u1", name: "One", role: "host", order: 1 },
    u2: { id: "u2", name: "Two", role: "guest", order: 2 },
  },
  currentParticipantId: "u1",
  currentRound: 1,
  strokes: {},
};

describe("GirinGamePanel", () => {
  it("uses bordered spreadsheet areas without merged cells or a participant panel", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={baseGame}
        participantId="u1"
        onSubmitPrompt={() => {}}
        onDrawStroke={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain('data-girin-grid="true"');
    expect(markup).toContain('data-girin-area="drawing"');
    expect(markup).toContain('data-girin-area="status"');
    expect(markup).not.toContain("data-merged-cell");
    expect(markup).not.toContain("참여 순서");
    expect(markup).not.toContain("문제 입력");
    expect(markup).not.toContain("내가 그린 기린 그림");
  });

  it("creates new strokes with the selected drawing color", () => {
    expect(createGirinStroke([{ x: 1, y: 2 }], "#e51c23")).toEqual({
      points: [{ x: 1, y: 2 }],
      color: "#e51c23",
      width: 4,
    });
  });

  it("shows the prompt form only to the current numbered questioner", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={baseGame}
        participantId="u1"
        onSubmitPrompt={() => {}}
        onDrawStroke={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain("정답 단어");
    expect(markup).toContain("최대 8자");
    expect(markup).toContain("1번");
  });

  it("shows the shared drawing board and five-minute timer during drawing", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={{ ...baseGame, status: "drawing", prompt: "기린", turnStartedAt: Date.now() }}
        participantId="u2"
        onSubmitPrompt={() => {}}
        onDrawStroke={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain("그림 그리기");
    expect(markup).toContain("05:00");
    expect(markup).toContain("정답은 채팅에 정확히 입력하세요");
  });
});
