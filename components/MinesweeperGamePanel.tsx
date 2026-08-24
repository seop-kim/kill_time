"use client";

import {
  countAdjacentMines,
  MINESWEEPER_COLUMNS,
  MINESWEEPER_ROWS,
  minesweeperCellKey,
  type MinesweeperGame,
} from "../lib/minesweeper";
import { columnLabel } from "../lib/columnLabel";

function getCellContent(game: MinesweeperGame, row: number, col: number): string {
  const key = minesweeperCellKey(row, col);
  if (!game.opened.includes(key)) return game.flagged.includes(key) ? "•" : "";
  if (game.mines.includes(key)) return "×";
  const adjacentMines = countAdjacentMines(game, row, col);
  return adjacentMines > 0 ? String(adjacentMines) : "";
}

export function MinesweeperGamePanel({
  game,
  onOpenCell,
  onToggleFlag,
}: {
  game: MinesweeperGame | null;
  onOpenCell: (row: number, col: number) => void;
  onToggleFlag: (row: number, col: number) => void;
}) {
  const isPlaying = game?.status === "playing";
  const openedSet = new Set(game?.opened ?? []);

  return (
    <div className="h-full overflow-auto bg-white">
      <div
        data-minesweeper-board="64x40"
        className="grid h-full min-h-[740px] min-w-[1704px] w-full text-[10px]"
        style={{
          gridTemplateColumns: `40px repeat(${MINESWEEPER_COLUMNS}, minmax(26px, 1fr))`,
          gridTemplateRows: `24px repeat(${MINESWEEPER_ROWS}, minmax(18px, 1fr))`,
        }}
      >
        <div className="sticky left-0 top-0 z-20 border border-[#d9e2f3] bg-[#f2f2f2]" />
        {Array.from({ length: MINESWEEPER_COLUMNS }, (_, column) => (
          <div key={`column-${column}`} className="sticky top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
            {columnLabel(column)}
          </div>
        ))}

        {Array.from({ length: MINESWEEPER_ROWS }, (_, row) => (
          <div key={`row-${row}`} className="contents">
            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">{row + 1}</div>
            {Array.from({ length: MINESWEEPER_COLUMNS }, (_, col) => {
              const key = minesweeperCellKey(row, col);
              const isOpened = openedSet.has(key);
              const cellContent = game ? getCellContent(game, row, col) : "";
              return (
                <button
                  key={key}
                  type="button"
                  data-minesweeper-cell={key}
                  disabled={!isPlaying || isOpened}
                  aria-label={`${row + 1}행 ${col + 1}열${cellContent ? ` ${cellContent}` : ""}`}
                  onClick={() => onOpenCell(row, col)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onToggleFlag(row, col);
                  }}
                  className="border border-[#d9e2f3] bg-white text-center font-medium text-[#1f1f1f] hover:bg-[#f8f8f8] disabled:cursor-default"
                >
                  {cellContent}
                </button>
              );
            })}
          </div>
        ))}

      </div>
    </div>
  );
}
