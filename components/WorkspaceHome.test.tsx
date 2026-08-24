import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceHome } from "./WorkspaceHome";

describe("WorkspaceHome", () => {
  it("renders the document hub actions and live wallet summary", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHome
        nickname="테스트 사용자"
        wallet={{ coin: 1_250, money: 125_000 }}
        onCreateDocument={() => {}}
        onOpenJoin={() => {}}
        onOpenExchange={() => {}}
      />,
    );

    expect(markup).toContain("문서 만들기");
    expect(markup).toContain("문서 입장하기");
    expect(markup).not.toContain("출석체크");
    expect(markup).toContain("1,250");
    expect(markup).toContain("125,000");
    expect(markup).not.toMatch(/data-workspace-cell="true"[^>]*>테스트 사용자의 작업 공간/);
    expect(markup).not.toContain("머니 교환");
  });

  it("shows a loading placeholder instead of a stale zero balance while the wallet is still loading", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHome
        nickname="테스트 사용자"
        wallet={{ coin: 0, money: 0 }}
        walletLoaded={false}
        onCreateDocument={() => {}}
        onOpenJoin={() => {}}
        onOpenExchange={() => {}}
      />,
    );

    expect(markup.match(/불러오는 중/g)).toHaveLength(2);
    expect(markup).not.toContain(">0</strong>");
  });

  it("keeps the hub as a compact, fully populated neutral cell grid", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHome
        nickname="테스트 사용자"
        wallet={{ coin: 0, money: 0 }}
        onCreateDocument={() => {}}
        onOpenJoin={() => {}}
        onOpenExchange={() => {}}
      />,
    );

    expect(markup).toContain("grid-cols-[36px_repeat(14,100px)]");
    expect(markup).toContain("auto-rows-[26px]");
    expect(markup.match(/data-workspace-cell="true"/g)).toHaveLength(14 * 28);
    expect(markup.match(/data-workspace-cell="true"[^>]*text-center/g)).toHaveLength(14 * 28);
    expect(markup).not.toContain("col-span-");
    expect(markup).not.toContain("bg-[#eaf7ee]");
    expect(markup).not.toContain("bg-[#edf4fb]");
    expect(markup).not.toContain("bg-[#fffdf2]");
    expect(markup).not.toContain("bg-[#fff2cc]");
  });
});
