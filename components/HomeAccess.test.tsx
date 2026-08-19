import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentJoinDialog, HomeAccessCard } from "./HomeAccess";

describe("Home access flow", () => {
  it("shows a display name and separate create and join actions", () => {
    const markup = renderToStaticMarkup(
      <HomeAccessCard
        name=""
        busy={false}
        onNameChange={() => {}}
        onCreate={() => {}}
        onOpenJoin={() => {}}
      />,
    );

    expect(markup).toContain("표시 이름");
    expect(markup).toContain("문서 만들기");
    expect(markup).toContain("문서 입장하기");
    expect(markup).not.toContain("문서 액세스");
    expect(markup).not.toContain("새 문서 만들기");
  });

  it("shows a room-code input dialog with an entry action", () => {
    const markup = renderToStaticMarkup(
      <DocumentJoinDialog
        open
        roomCode=""
        busy={false}
        onChange={() => {}}
        onClose={() => {}}
        onJoin={() => {}}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("방 코드");
    expect(markup).toContain("입장");
    expect(markup).toContain("취소");
  });
});
