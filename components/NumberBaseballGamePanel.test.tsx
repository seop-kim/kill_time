import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createNumberBaseballGame } from "../lib/numberBaseball";
import { NumberBaseballGamePanel } from "./NumberBaseballGamePanel";

describe("NumberBaseballGamePanel", () => {
  it("renders the shared turn-based game inside spreadsheet cells", () => {
    const game = createNumberBaseballGame(
      [
        { id: "p1", name: "하나" },
        { id: "p2", name: "둘" },
        { id: "p3", name: "셋" },
      ],
      "encrypted",
      100,
      () => 0.99,
    );
    const markup = renderToStaticMarkup(
      <NumberBaseballGamePanel game={game} playerId="p1" onGuess={() => {}} />,
    );

    expect(markup).toContain('data-number-baseball-grid="true"');
    expect(markup).toContain("최대 3명");
    expect(markup).toContain("현재 차례");
    expect(markup).toContain("숫자 3개");
    expect(markup).toContain('data-number-baseball-player="p1"');
    expect(markup).toContain('data-number-baseball-player="p3"');
  });

  it("shows a finished winner or draw result", () => {
    const game = createNumberBaseballGame(
      [{ id: "p1", name: "하나" }, { id: "p2", name: "둘" }],
      "encrypted",
      100,
      () => 0.99,
    );
    const markup = renderToStaticMarkup(
      <NumberBaseballGamePanel
        game={{ ...game, status: "finished", winnerId: "p1", finishReason: "correct" }}
        playerId="p1"
        onGuess={() => {}}
      />,
    );

    expect(markup).toContain('data-number-baseball-field="result"');
    expect(markup).toContain("하나님이 승리했습니다");
  });
});
