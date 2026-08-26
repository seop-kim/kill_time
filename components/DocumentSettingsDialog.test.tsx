import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentSettingsDialog } from "./DocumentSettingsDialog";

describe("DocumentSettingsDialog", () => {
  it("shows game choices and the Seotda stake field", () => {
    const markup = renderToStaticMarkup(
      <DocumentSettingsDialog
        open
        title="문서 만들기"
        gameId="seotda"
        moneyStake={10_000}
        submitLabel="문서 만들기"
        onGameChange={() => {}}
        onMoneyStakeChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("문서 만들기");
    expect(markup).toContain("[1:1] 오목");
    expect(markup).toContain("[N:M] 내가 그린 기린 그림");
    expect(markup).toContain("[N:M (최대 6)] Up");
    expect(markup).toContain("[N:M (최대 3)] 숫자야구");
    expect(markup).toContain("[솔로] 지뢰찾기");
    expect(markup).toContain("판돈");
    expect(markup).toContain("1000000");
    expect(markup).toContain("10,000");
  });
});
