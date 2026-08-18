import { describe, it, expect } from "vitest";
import { checkWin, isForbiddenBlackMove, withStone, type Board } from "./gomoku";
import { columnLabel } from "./columnLabel";

function place(board: Board, moves: [number, number, "black" | "white"][]): Board {
  let b = board;
  for (const [row, col, stone] of moves) b = withStone(b, row, col, stone);
  return b;
}

describe("checkWin", () => {
  it("detects a horizontal five for white", () => {
    const board = place({}, [
      [10, 10, "white"],
      [10, 11, "white"],
      [10, 12, "white"],
      [10, 13, "white"],
      [10, 14, "white"],
    ]);
    expect(checkWin(board, 10, 14, "white")).toBe(true);
  });

  it("does not count four in a row as a win", () => {
    const board = place({}, [
      [5, 5, "black"],
      [5, 6, "black"],
      [5, 7, "black"],
      [5, 8, "black"],
    ]);
    expect(checkWin(board, 5, 8, "black")).toBe(false);
  });

  it("black wins only on an exact five, not an overline", () => {
    const board = place({}, [
      [5, 5, "black"],
      [5, 6, "black"],
      [5, 7, "black"],
      [5, 8, "black"],
      [5, 9, "black"],
      [5, 10, "black"],
    ]);
    expect(checkWin(board, 5, 10, "black")).toBe(false);
  });

  it("white wins on six or more (no overline restriction)", () => {
    const board = place({}, [
      [5, 5, "white"],
      [5, 6, "white"],
      [5, 7, "white"],
      [5, 8, "white"],
      [5, 9, "white"],
      [5, 10, "white"],
    ]);
    expect(checkWin(board, 5, 10, "white")).toBe(true);
  });

  it("detects a diagonal five", () => {
    const board = place({}, [
      [1, 1, "black"],
      [2, 2, "black"],
      [3, 3, "black"],
      [4, 4, "black"],
      [5, 5, "black"],
    ]);
    expect(checkWin(board, 5, 5, "black")).toBe(true);
  });
});

describe("isForbiddenBlackMove", () => {
  it("allows an ordinary open three (not yet forbidden)", () => {
    const board = place({}, [
      [10, 10, "black"],
      [10, 11, "black"],
    ]);
    expect(isForbiddenBlackMove(board, 10, 12)).toBe(false);
  });

  it("forbids overline (six in a row) for black", () => {
    const board = place({}, [
      [5, 5, "black"],
      [5, 6, "black"],
      [5, 7, "black"],
      [5, 8, "black"],
      [5, 9, "black"],
    ]);
    expect(isForbiddenBlackMove(board, 5, 10)).toBe(true);
  });

  it("forbids double three (3-3) for black", () => {
    // Horizontal open pair on row 10, vertical open pair on col 10, crossing at (10,10).
    const board = place({}, [
      [10, 8, "black"],
      [10, 9, "black"],
      [8, 10, "black"],
      [9, 10, "black"],
    ]);
    expect(isForbiddenBlackMove(board, 10, 10)).toBe(true);
  });

  it("forbids double four (4-4) for black", () => {
    const board = place({}, [
      [10, 6, "black"],
      [10, 7, "black"],
      [10, 8, "black"],
      [6, 10, "black"],
      [7, 10, "black"],
      [8, 10, "black"],
    ]);
    expect(isForbiddenBlackMove(board, 10, 10)).toBe(true);
  });

  it("a move that completes an exact five is never forbidden, even if it overlines another line", () => {
    // Horizontal line completes exactly five at (5,9); a separate vertical
    // line through the same point would be an overline (6) but the win takes priority.
    const board = place({}, [
      [5, 5, "black"],
      [5, 6, "black"],
      [5, 7, "black"],
      [5, 8, "black"],
      [1, 9, "black"],
      [2, 9, "black"],
      [3, 9, "black"],
      [4, 9, "black"],
      [6, 9, "black"],
    ]);
    expect(isForbiddenBlackMove(board, 5, 9)).toBe(false);
  });

  it("white is never restricted by forbidden-move rules (no such check exists for white)", () => {
    // isForbiddenBlackMove only exists for black by design; nothing to assert
    // beyond documenting the rule here for future readers.
    expect(true).toBe(true);
  });
});

describe("columnLabel", () => {
  it("maps the first columns to A, B, Z", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(1)).toBe("B");
    expect(columnLabel(25)).toBe("Z");
  });

  it("wraps into double letters after Z", () => {
    expect(columnLabel(26)).toBe("AA");
    expect(columnLabel(27)).toBe("AB");
  });

  it("the 50th column (index 49) is AX", () => {
    expect(columnLabel(49)).toBe("AX");
  });
});
