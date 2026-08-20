import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExchangeSheet } from "./ExchangeSheet";

describe("ExchangeSheet", () => {
  it("shows both exchange directions and the fixed rate", () => {
    const markup = renderToStaticMarkup(
      <ExchangeSheet
        wallet={{ coin: 300, money: 10_000 }}
        onExchange={() => {}}
        onBack={() => {}}
      />,
    );

    expect(markup).toContain("코인 → 머니");
    expect(markup).toContain("머니 → 코인");
    expect(markup).toContain("1 coin = 100 money");
    expect(markup).toContain("300");
    expect(markup).toContain("10,000");
  });
});
