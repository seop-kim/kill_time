import { describe, expect, it } from "vitest";
import {
  MINESWEEPER_COLUMNS,
  MINESWEEPER_MINE_COUNT,
  MINESWEEPER_ROWS,
  countAdjacentMines,
  createMinesweeperGame,
  getRemainingMineCount,
  openMinesweeperCell,
  toggleMinesweeperFlag,
} from "./minesweeper";

describe("Minesweeper game setup", () => {
  it("creates a fixed expert board before the first cell is opened", () => {
    const game = createMinesweeperGame("mine-1", 12_345, 100);

    expect([MINESWEEPER_COLUMNS, MINESWEEPER_ROWS, MINESWEEPER_MINE_COUNT]).toEqual([30, 16, 99]);
    expect(game).toMatchObject({
      matchId: "mine-1",
      seed: 12_345,
      status: "playing",
      startedAt: 100,
      mines: [],
      opened: [],
      flagged: [],
    });
  });
});

describe("Minesweeper first open", () => {
  it("places deterministic mines outside the opened cell and its neighbors", () => {
    const opened = openMinesweeperCell(createMinesweeperGame("mine-1", 12_345, 100), 8, 15, 101);
    const repeated = openMinesweeperCell(createMinesweeperGame("mine-2", 12_345, 100), 8, 15, 101);

    expect(opened.mines).toHaveLength(MINESWEEPER_MINE_COUNT);
    expect(opened.mines).toEqual(repeated.mines);
    for (let row = 7; row <= 9; row += 1) {
      for (let col = 14; col <= 16; col += 1) {
        expect(opened.mines).not.toContain(`${row}:${col}`);
      }
    }
    expect(opened.firstOpened).toBe("8:15");
    expect(opened.opened).toContain("8:15");
  });
});

describe("Minesweeper flags", () => {
  it("toggles flags on unopened cells without exceeding the mine count", () => {
    const game = createMinesweeperGame("mine-1", 1, 100);
    const flagged = toggleMinesweeperFlag(game, 0, 0);

    expect(flagged.flagged).toEqual(["0:0"]);
    expect(toggleMinesweeperFlag(flagged, 0, 0).flagged).toEqual([]);

    const full = {
      ...game,
      flagged: Array.from({ length: MINESWEEPER_MINE_COUNT }, (_, index) => `0:${index}`),
    };
    expect(toggleMinesweeperFlag(full, 1, 0)).toBe(full);
  });
});

describe("Minesweeper resolution", () => {
  it("cascades through zero cells, exposes adjacent counts, and wins after every safe cell opens", () => {
    const game = {
      ...createMinesweeperGame("mine-1", 1, 100),
      firstOpened: "3:3",
      mines: ["0:0"],
    };
    const won = openMinesweeperCell(game, 3, 3, 101);

    expect(countAdjacentMines(won, 0, 1)).toBe(1);
    expect(won.opened).toHaveLength(MINESWEEPER_COLUMNS * MINESWEEPER_ROWS - 1);
    expect(won.status).toBe("won");
    expect(won.finishedAt).toBe(101);
  });

  it("reveals mines and loses when a mined cell is opened", () => {
    const game = {
      ...createMinesweeperGame("mine-1", 1, 100),
      firstOpened: "3:3",
      mines: ["0:0", "0:1"],
      flagged: ["0:1"],
    };
    const lost = openMinesweeperCell(game, 0, 0, 101);

    expect(lost.status).toBe("lost");
    expect(lost.finishedAt).toBe(101);
    expect(lost.opened).toEqual(expect.arrayContaining(["0:0", "0:1"]));
    expect(getRemainingMineCount(lost)).toBe(98);
  });
});
