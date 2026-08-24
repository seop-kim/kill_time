import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMinesweeperGame } from "../lib/minesweeper";
import { MinesweeperGamePanel } from "./MinesweeperGamePanel";

describe("MinesweeperGamePanel", () => {
  it("renders the expert board as spreadsheet cells with counters", () => {
    const markup = renderToStaticMarkup(
      <MinesweeperGamePanel
        game={createMinesweeperGame("mine-1", 1, 100)}
        onOpenCell={() => {}}
        onToggleFlag={() => {}}
        onRestart={() => {}}
      />,
    );

    expect(markup).toContain('data-minesweeper-board="30x16"');
    expect(markup).toContain('data-minesweeper-field="remaining-mines"');
    expect(markup).toContain('data-minesweeper-field="elapsed-time"');
    expect(markup).toContain('data-minesweeper-cell="0:0"');
    expect(markup).toContain('data-minesweeper-cell="15:29"');
    expect(markup).toContain(">99<");
  });
});
