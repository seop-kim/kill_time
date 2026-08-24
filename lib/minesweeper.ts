export const MINESWEEPER_COLUMNS = 30;
export const MINESWEEPER_ROWS = 16;
export const MINESWEEPER_MINE_COUNT = 99;

export type MinesweeperStatus = "waiting" | "playing" | "won" | "lost";

export interface MinesweeperGame {
  matchId: string;
  seed: number;
  status: MinesweeperStatus;
  startedAt: number;
  finishedAt?: number;
  firstOpened?: string;
  mines: string[];
  opened: string[];
  flagged: string[];
}

export function minesweeperCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function isMinesweeperCellInBounds(row: number, col: number): boolean {
  return row >= 0 && row < MINESWEEPER_ROWS && col >= 0 && col < MINESWEEPER_COLUMNS;
}

function parseMinesweeperCellKey(key: string): { row: number; col: number } | null {
  const [rowValue, colValue] = key.split(":");
  const row = Number(rowValue);
  const col = Number(colValue);
  return Number.isInteger(row) && Number.isInteger(col) && isMinesweeperCellInBounds(row, col) ? { row, col } : null;
}

function getNeighborCells(row: number, col: number): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (isMinesweeperCellInBounds(nextRow, nextCol)) cells.push({ row: nextRow, col: nextCol });
    }
  }
  return cells;
}

function createSeededRandom(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function getSafeFirstOpenKeys(row: number, col: number): Set<string> {
  const safeKeys = new Set<string>();
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (isMinesweeperCellInBounds(nextRow, nextCol)) safeKeys.add(minesweeperCellKey(nextRow, nextCol));
    }
  }
  return safeKeys;
}

function createMineKeys(seed: number, firstRow: number, firstCol: number): string[] {
  const safeKeys = getSafeFirstOpenKeys(firstRow, firstCol);
  const candidates: string[] = [];
  for (let row = 0; row < MINESWEEPER_ROWS; row += 1) {
    for (let col = 0; col < MINESWEEPER_COLUMNS; col += 1) {
      const key = minesweeperCellKey(row, col);
      if (!safeKeys.has(key)) candidates.push(key);
    }
  }

  const random = createSeededRandom(seed);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
  return candidates.slice(0, MINESWEEPER_MINE_COUNT);
}

export function createMinesweeperGame(matchId: string, seed: number, now = Date.now()): MinesweeperGame {
  return {
    matchId,
    seed,
    status: "playing",
    startedAt: now,
    mines: [],
    opened: [],
    flagged: [],
  };
}

export function countAdjacentMines(game: MinesweeperGame, row: number, col: number): number {
  if (!isMinesweeperCellInBounds(row, col)) return 0;
  const mineSet = new Set(game.mines);
  return getNeighborCells(row, col).filter((cell) => mineSet.has(minesweeperCellKey(cell.row, cell.col))).length;
}

export function getRemainingMineCount(game: MinesweeperGame): number {
  return Math.max(0, MINESWEEPER_MINE_COUNT - game.flagged.length);
}

function openSafeCells(game: MinesweeperGame, startKey: string): string[] {
  const mineSet = new Set(game.mines);
  const flaggedSet = new Set(game.flagged);
  const openedSet = new Set(game.opened);
  const queue = [startKey];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || openedSet.has(key) || mineSet.has(key) || flaggedSet.has(key)) continue;
    const cell = parseMinesweeperCellKey(key);
    if (!cell) continue;
    openedSet.add(key);
    if (countAdjacentMines(game, cell.row, cell.col) !== 0) continue;
    for (const neighbor of getNeighborCells(cell.row, cell.col)) {
      const neighborKey = minesweeperCellKey(neighbor.row, neighbor.col);
      if (!openedSet.has(neighborKey) && !mineSet.has(neighborKey) && !flaggedSet.has(neighborKey)) queue.push(neighborKey);
    }
  }

  return [...openedSet];
}

export function openMinesweeperCell(game: MinesweeperGame, row: number, col: number, now = Date.now()): MinesweeperGame {
  if (game.status !== "playing" || !isMinesweeperCellInBounds(row, col)) return game;
  const key = minesweeperCellKey(row, col);
  if (game.opened.includes(key) || game.flagged.includes(key)) return game;

  const mines = game.mines.length > 0 ? game.mines : createMineKeys(game.seed, row, col);
  const firstOpened = game.firstOpened ?? key;
  if (mines.includes(key)) {
    return {
      ...game,
      mines,
      firstOpened,
      opened: [...new Set([...game.opened, ...mines])],
      status: "lost",
      finishedAt: now,
    };
  }

  const opened = openSafeCells({ ...game, mines }, key);
  const safeCellCount = MINESWEEPER_COLUMNS * MINESWEEPER_ROWS - mines.length;
  const won = opened.length === safeCellCount;

  return {
    ...game,
    mines,
    firstOpened,
    opened,
    ...(won ? { status: "won" as const, finishedAt: now } : {}),
  };
}

export function toggleMinesweeperFlag(game: MinesweeperGame, row: number, col: number): MinesweeperGame {
  if (game.status !== "playing" || !isMinesweeperCellInBounds(row, col)) return game;
  const key = minesweeperCellKey(row, col);
  if (game.opened.includes(key)) return game;
  if (game.flagged.includes(key)) {
    return { ...game, flagged: game.flagged.filter((flaggedKey) => flaggedKey !== key) };
  }
  if (game.flagged.length >= MINESWEEPER_MINE_COUNT) return game;
  return { ...game, flagged: [...game.flagged, key] };
}
