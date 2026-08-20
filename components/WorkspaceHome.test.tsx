import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceHome } from "./WorkspaceHome";

describe("WorkspaceHome", () => {
  it("renders the document hub actions and live wallet summary", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHome
        nickname="테스트 사용자"
        wallet={{ coin: 1_250, money: 125_000 }}
        attendanceClaimed={false}
        onCreateDocument={() => {}}
        onOpenJoin={() => {}}
        onOpenExchange={() => {}}
        onClaimAttendance={() => {}}
      />,
    );

    expect(markup).toContain("문서 만들기");
    expect(markup).toContain("문서 입장하기");
    expect(markup).toContain("머니 교환");
    expect(markup).toContain("출석체크");
    expect(markup).toContain("1,250");
    expect(markup).toContain("125,000");
  });
});
