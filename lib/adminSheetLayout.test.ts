import { describe, expect, it } from "vitest";
import { ADMIN_SHEET_LAYOUT } from "./adminSheetLayout";

describe("ADMIN_SHEET_LAYOUT", () => {
  it("starts every administrator sheet section at A1 without a top-left margin", () => {
    expect(ADMIN_SHEET_LAYOUT.economy).toMatchObject({ col: 1, row: 1 });
    expect(ADMIN_SHEET_LAYOUT.master).toMatchObject({ col: 1, row: 1 });
    expect(ADMIN_SHEET_LAYOUT.detail).toMatchObject({ row: 1 });
  });

  it("places the detail section immediately after the left master list", () => {
    expect(ADMIN_SHEET_LAYOUT.detail.col).toBe(
      ADMIN_SHEET_LAYOUT.master.col + ADMIN_SHEET_LAYOUT.master.colSpan,
    );
  });
});
