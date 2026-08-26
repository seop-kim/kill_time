import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminCellSheet, AdminSheetArea } from "./AdminCellSheet";

describe("AdminCellSheet", () => {
  it("renders every neutral spreadsheet cell with column and row headers", () => {
    const markup = renderToStaticMarkup(
      <AdminCellSheet>
        <AdminSheetArea col={3} row={4} colSpan={6} rowSpan={2}>사용자 목록</AdminSheetArea>
      </AdminCellSheet>,
    );

    expect(markup).toContain('data-admin-cell-sheet="true"');
    expect(markup.match(/data-admin-cell="true"/g)).toHaveLength(17 * 30);
    expect(markup).toContain('data-admin-column="A"');
    expect(markup).toContain('data-admin-column="Q"');
    expect(markup).toContain('data-admin-row="1"');
    expect(markup).toContain('data-admin-row="30"');
    expect(markup).toMatch(/data-admin-row="1"[^>]*flex[^>]*items-center[^>]*justify-center/);
    expect(markup).toContain('data-admin-row="2" style="grid-column:1;grid-row:3"');
  });

  it("places a content area at a merged spreadsheet range above the blank cells", () => {
    const markup = renderToStaticMarkup(
      <AdminCellSheet>
        <AdminSheetArea col={3} row={4} colSpan={6} rowSpan={2}>사용자 목록</AdminSheetArea>
      </AdminCellSheet>,
    );

    expect(markup).toContain('data-admin-sheet-area="true"');
    expect(markup).toContain('data-admin-range="C4:H5"');
    expect(markup).toContain("grid-column:4 / span 6");
    expect(markup).toContain("grid-row:5 / span 2");
    expect(markup).toContain("사용자 목록");
  });
});
