import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminMasterDetailSheet } from "./AdminMasterDetailSheet";

describe("AdminMasterDetailSheet", () => {
  it("keeps a left master list and a right detail pane in the spreadsheet area", () => {
    const markup = renderToStaticMarkup(
      <AdminMasterDetailSheet master={<div>왼쪽 목록</div>} detail={<div>오른쪽 상세</div>} />,
    );

    expect(markup).toContain('data-admin-master-detail="true"');
    expect(markup).toContain('data-admin-master="true"');
    expect(markup).toContain('data-admin-detail="true"');
    expect(markup).toContain("왼쪽 목록");
    expect(markup).toContain("오른쪽 상세");
  });
});
