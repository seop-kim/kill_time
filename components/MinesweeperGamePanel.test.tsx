import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMinesweeperGame } from "../lib/minesweeper";
import { MinesweeperGamePanel } from "./MinesweeperGamePanel";

describe("MinesweeperGamePanel", () => {
  it("fills the sheet with neutral spreadsheet cells without a status row", () => {
    const markup = renderToStaticMarkup(
      <MinesweeperGamePanel
        game={createMinesweeperGame("mine-1", 1, 100)}
        onOpenCell={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(markup).toContain('data-minesweeper-board="64x40"');
    expect(markup).toContain('data-minesweeper-cell="0:0"');
    expect(markup).toContain('data-minesweeper-cell="39:63"');
    expect(markup).not.toContain("현황");
    expect(markup).not.toContain("남은 지뢰");
    expect(markup).not.toContain("경과 시간");
  });

  it("renders an existing board even when Firebase omitted empty cell lists", () => {
    const incompleteGame = {
      ...createMinesweeperGame("mine-1", 1, 100),
      mines: undefined,
      opened: undefined,
      flagged: undefined,
    } as unknown as ReturnType<typeof createMinesweeperGame>;

    expect(() => renderToStaticMarkup(
      <MinesweeperGamePanel game={incompleteGame} onOpenCell={() => {}} onToggleFlag={() => {}} />,
    )).not.toThrow();
  });
});
