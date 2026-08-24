import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WORKSPACE_PROFILE_GAMES, WorkspaceChrome } from "./WorkspaceChrome";

describe("WorkspaceChrome", () => {
  it("keeps the document hub header and footer around page content", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChrome nickname="테스트 사용자">
        <div data-page-content="true">페이지 셀 내용</div>
      </WorkspaceChrome>,
    );

    expect(markup).toContain('data-excel-tab-row="true"');
    expect(markup).toContain("문서 허브");
    expect(markup).toContain(">홈</button>");
    expect(markup).not.toContain("테스트 사용자님의 작업 공간");
    expect(markup).toContain("머니교환");
    expect(markup).toContain('data-page-content="true"');
  });

  it("replaces any workspace sheet with the sensitivity cover when enabled", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChrome
        nickname="테스트 사용자"
        initialSensitiveMode
      >
        <div data-page-content="true">페이지 셀 내용</div>
      </WorkspaceChrome>,
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-work-cover="true"');
    expect(markup).not.toContain('data-page-content="true"');
  });

  it("uses the playable games for profile records instead of workspace sheets", () => {
    expect(WORKSPACE_PROFILE_GAMES.map((game) => game.id)).toEqual(["omok", "girin", "seotda", "minesweeper"]);
    expect(WORKSPACE_PROFILE_GAMES.map((game) => game.label)).toEqual(["Omok", "girin", "Up", "지뢰찾기"]);
  });
});
