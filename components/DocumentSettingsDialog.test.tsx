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
    expect(markup).toContain("오목");
    expect(markup).toContain("기린");
    expect(markup).toContain("Up");
    expect(markup).toContain("판돈");
    expect(markup).toContain("1000000");
    expect(markup).toContain("10,000");
  });
});
