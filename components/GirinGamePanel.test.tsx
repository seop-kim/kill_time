import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGirinBrushPixels, createGirinPixel } from "../lib/girin";
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
  pixels: {},
};

describe("GirinGamePanel", () => {
  it("keeps only the bordered drawing area during an active turn", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={{ ...baseGame, status: "drawing", turnStartedAt: Date.now() }}
        participantId="u1"
        onSubmitPrompt={() => {}}
        onDrawPixels={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain('data-girin-grid="true"');
    expect(markup).toContain('data-girin-area="drawing"');
    expect(markup).toContain('data-girin-pixel-board="true"');
    expect(markup).not.toContain('data-girin-area="status"');
    expect(markup).not.toContain('data-girin-area="timer"');
    expect(markup).not.toContain('data-girin-area="drawer"');
    expect(markup).not.toContain('data-girin-area="footer"');
    expect(markup).not.toContain("data-merged-cell");
    expect(markup).not.toContain("참여 순서");
    expect(markup).not.toContain("문제 입력");
    expect(markup).not.toContain("내가 그린 기린 그림");
  });

  it("creates a pixel with its cell coordinates and selected color", () => {
    expect(createGirinPixel(12, 34, "#e51c23")).toEqual({
      row: 12,
      col: 34,
      color: "#e51c23",
    });
  });

  it("paints exactly one cell for a one-pixel brush and supports erasing", () => {
    expect(createGirinBrushPixels(12, 34, 1, "#e51c23")).toEqual([
      { row: 12, col: 34, color: "#e51c23" },
    ]);
    expect(createGirinPixel(12, 34, null)).toEqual({ row: 12, col: 34, color: null });
  });

  it("shows the prompt form only to the current questioner", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={baseGame}
        participantId="u1"
        onSubmitPrompt={() => {}}
        onDrawPixels={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain("정답 단어");
    expect(markup).toContain("최대 8자");
    expect(markup).not.toContain("1번");
  });

  it("shows only the shared pixel board during drawing", () => {
    const markup = renderToStaticMarkup(
      <GirinGamePanel
        game={{ ...baseGame, status: "drawing", prompt: "기린", turnStartedAt: Date.now() }}
        participantId="u1"
        onSubmitPrompt={() => {}}
        onDrawPixels={() => {}}
        onTimeUp={() => {}}
      />,
    );

    expect(markup).toContain('data-girin-pixel-board="true"');
    expect(markup).toContain('data-girin-pixel-count="256x144"');
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("그림 그리기");
    expect(markup).not.toContain("남은 시간");
    expect(markup).not.toContain("정답 단어를 제출하고 그림을 그려 주세요.");
    expect(markup).not.toContain("정답은 채팅에 정확히 입력하세요");
  });
});
