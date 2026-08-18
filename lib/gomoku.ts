export const BOARD_SIZE = 50;

export type Stone = "black" | "white";
export type Board = Record<string, Stone>;

export function cellKey(row: number, col: number): string {
  return `${row}_${col}`;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function getStone(board: Board, row: number, col: number): Stone | undefined {
  return board[cellKey(row, col)];
}

export function withStone(board: Board, row: number, col: number, stone: Stone): Board {
  return { ...board, [cellKey(row, col)]: stone };
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

type Cell = "mine" | "opp" | "empty" | "wall";

// Window radius around the candidate cell. Large enough to detect a three
// becoming an open four two moves out, without needing to re-touch the board.
const RADIUS = 7;

function buildLine(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): Cell[] {
  const cells: Cell[] = [];
  for (let i = -RADIUS; i <= RADIUS; i++) {
    if (i === 0) {
      cells.push("mine");
      continue;
    }
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c)) {
      cells.push("wall");
      continue;
    }
    const s = getStone(board, r, c);
    if (s === undefined) cells.push("empty");
    else cells.push(s === stone ? "mine" : "opp");
  }
  return cells;
}

function hasRunOfAtLeast(cells: Cell[], n: number): boolean {
  let run = 0;
  for (const c of cells) {
    if (c === "mine") {
      run++;
      if (run >= n) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/** Empty indexes in `cells` where placing one more "mine" stone completes five or more in a row. */
function completionIndexes(cells: Cell[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== "empty") continue;
    const trial = cells.slice();
    trial[i] = "mine";
    if (hasRunOfAtLeast(trial, 5)) result.push(i);
  }
  return result;
}

/** An "open three": some empty point that, if played next, creates an open four (two ways to complete five). */
function isOpenThreeLine(cells: Cell[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== "empty") continue;
    const trial = cells.slice();
    trial[i] = "mine";
    if (completionIndexes(trial).length >= 2) return true;
  }
  return false;
}

/** Call after the stone has already been placed on `board`. */
export function checkWin(board: Board, row: number, col: number, stone: Stone): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const cells = buildLine(board, row, col, dr, dc, stone);
    const run = (() => {
      let longest = 0;
      let current = 0;
      for (const c of cells) {
        if (c === "mine") {
          current++;
          longest = Math.max(longest, current);
        } else {
          current = 0;
        }
      }
      return longest;
    })();
    if (stone === "white" ? run >= 5 : run === 5) return true;
  }
  return false;
}

/**
 * Renju forbidden-move check for black (선공) only: double-three, double-four,
 * overline (6+). A move that completes an exact five wins outright and is
 * never forbidden, even if it also creates one of the above patterns.
 *
 * This is a practical approximation of official renju rules, not a
 * tournament-grade implementation (rare exotic multi-line interactions may
 * not be reproduced exactly).
 */
export function isForbiddenBlackMove(board: Board, row: number, col: number): boolean {
  if (checkWin(withStone(board, row, col, "black"), row, col, "black")) return false;

  let fours = 0;
  let openThrees = 0;

  for (const [dr, dc] of DIRECTIONS) {
    const cells = buildLine(board, row, col, dr, dc, "black");
    if (hasRunOfAtLeast(cells, 6)) return true; // overline (장목)
    if (completionIndexes(cells).length >= 1) fours++;
    if (isOpenThreeLine(cells)) openThrees++;
  }

  return fours >= 2 || openThrees >= 2;
}
