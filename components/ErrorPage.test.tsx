import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorPage } from "./ErrorPage";

describe("ErrorPage", () => {
  it("renders an error message and a home action", () => {
    const markup = renderToStaticMarkup(
      <ErrorPage title="문서를 찾을 수 없습니다." message="존재하지 않거나 삭제된 문서입니다." />,
    );

    expect(markup).toContain('data-error-page="true"');
    expect(markup).toContain("문서를 찾을 수 없습니다.");
    expect(markup).toContain("존재하지 않거나 삭제된 문서입니다.");
    expect(markup).toContain("처음 화면으로 이동");
  });
});
