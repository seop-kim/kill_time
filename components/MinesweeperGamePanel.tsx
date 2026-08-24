"use client";

import { useEffect, useState } from "react";
import {
  countAdjacentMines,
  getRemainingMineCount,
  MINESWEEPER_COLUMNS,
  MINESWEEPER_ROWS,
  minesweeperCellKey,
  type MinesweeperGame,
} from "../lib/minesweeper";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function getStatusLabel(game: MinesweeperGame | null): string {
  if (!game) return "대기 중";
  if (game.status === "won") return "클리어";
  if (game.status === "lost") return "지뢰를 밟았습니다";
  return "진행 중";
}

function getCellContent(game: MinesweeperGame, row: number, col: number): string {
  const key = minesweeperCellKey(row, col);
  if (!game.opened.includes(key)) return game.flagged.includes(key) ? "⚑" : "";
  if (game.mines.includes(key)) return "✹";
  const adjacentMines = countAdjacentMines(game, row, col);
  return adjacentMines > 0 ? String(adjacentMines) : "";
}

export function MinesweeperGamePanel({
  game,
  onOpenCell,
  onToggleFlag,
  onRestart,
}: {
  game: MinesweeperGame | null;
  onOpenCell: (row: number, col: number) => void;
  onToggleFlag: (row: number, col: number) => void;
  onRestart?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const isPlaying = game?.status === "playing";
  const elapsedSeconds = game ? Math.max(0, Math.floor(((game.finishedAt ?? now) - game.startedAt) / 1000)) : 0;
  const openedSet = new Set(game?.opened ?? []);

  useEffect(() => {
    setNow(Date.now());
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [game?.matchId, isPlaying]);

  return (
    <div className="h-full overflow-auto bg-white">
      <div data-minesweeper-board="30x16" className="grid min-h-full min-w-max grid-cols-[40px_repeat(30,24px)] auto-rows-[24px] text-[11px]">
        <div className="sticky left-0 top-0 z-20 border border-[#d9e2f3] bg-[#f2f2f2]" />
        {Array.from({ length: MINESWEEPER_COLUMNS }, (_, column) => (
          <div key={`column-${column}`} className="sticky top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center leading-[23px] text-[#49637a]">
            {String.fromCharCode(65 + column)}
          </div>
        ))}

        <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center leading-[23px] text-[#49637a]">현황</div>
        <div data-minesweeper-field="status" className="col-span-10 border border-[#d9e2f3] bg-white px-2 leading-[23px] text-[#333]">
          지뢰찾기 · <strong>{getStatusLabel(game)}</strong>
        </div>
        <div data-minesweeper-field="remaining-mines" className="col-span-10 border border-[#d9e2f3] bg-white px-2 leading-[23px] text-[#333]">
          남은 지뢰 <strong>{game ? getRemainingMineCount(game) : "-"}</strong>
        </div>
        <div data-minesweeper-field="elapsed-time" className="col-span-10 border border-[#d9e2f3] bg-white px-2 leading-[23px] text-[#333]">
          경과 시간 <strong>{formatElapsed(elapsedSeconds)}</strong>
        </div>

        {Array.from({ length: MINESWEEPER_ROWS }, (_, row) => (
          <div key={`row-${row}`} className="contents">
            <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center leading-[23px] text-[#789]">{row + 1}</div>
            {Array.from({ length: MINESWEEPER_COLUMNS }, (_, col) => {
              const key = minesweeperCellKey(row, col);
              const isOpened = openedSet.has(key);
              const cellContent = game ? getCellContent(game, row, col) : "";
              const isMine = Boolean(game?.mines.includes(key));
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
                  className={`border text-center leading-[23px] ${isOpened ? "border-[#e8edf3] bg-white font-semibold" : "border-[#b7c9e2] bg-[#f8fbff] hover:bg-[#eaf2f8]"} ${isMine && isOpened ? "text-[#b91c1c]" : cellContent === "⚑" ? "text-[#b45309]" : "text-[#1f4e79]"} disabled:cursor-default`}
                >
                  {cellContent}
                </button>
              );
            })}
          </div>
        ))}

        {(game?.status === "won" || game?.status === "lost") && (
          <>
            <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center leading-[23px] text-[#789]">결과</div>
            <div data-minesweeper-field="result" className="col-span-20 border border-[#e8edf3] bg-white px-2 leading-[23px] text-[#333]">
              {game.status === "won" ? "클리어했습니다. 코인 10개를 지급했습니다." : "지뢰를 밟았습니다. 다시 도전해 보세요."}
            </div>
            <div className="col-span-10 border border-[#e8edf3] bg-white p-[2px]">
              {onRestart && <button type="button" onClick={onRestart} className="h-full w-full border border-[#217346] bg-[#217346] text-[11px] text-white hover:bg-[#1a5c38]">다시 하기</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
