import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeotdaGamePanel } from "./SeotdaGamePanel";

describe("SeotdaGamePanel", () => {
  it("keeps the future Seotda surface inside the spreadsheet cells", () => {
    const markup = renderToStaticMarkup(<SeotdaGamePanel moneyStake={10_000} />);

    expect(markup).toContain("섯다");
    expect(markup).toContain("판돈");
    expect(markup).toContain("10,000 money");
    expect(markup).toContain("준비 중");
  });
});
