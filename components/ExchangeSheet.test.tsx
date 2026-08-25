import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExchangeSheet } from "./ExchangeSheet";

describe("ExchangeSheet", () => {
  it("shows both exchange directions and the fixed rate", () => {
    const markup = renderToStaticMarkup(
      <ExchangeSheet
        wallet={{ coin: 300, money: 10_000 }}
        onExchange={() => {}}
      />,
    );

    expect(markup).toContain("코인 → 머니");
    expect(markup).toContain("머니 → 코인");
    expect(markup).toContain("1 coin = 100 money");
    expect(markup).toContain("300");
    expect(markup).toContain("10,000");
    expect(markup).not.toContain(">머니 교환</div>");
    expect(markup).not.toContain("허브로 돌아가기");
  });

  it("shows the configured reverse exchange rate", () => {
    const markup = renderToStaticMarkup(
      <ExchangeSheet
        wallet={{ coin: 300, money: 10_000 }}
        onExchange={() => {}}
        coinToMoneyRate={100}
        moneyToCoinRate={95}
      />,
    );

    expect(markup).toContain("95 money = 1 coin");
  });

  it("keeps the exchange sheet as a fully populated neutral cell grid", () => {
    const markup = renderToStaticMarkup(
      <ExchangeSheet
        wallet={{ coin: 300, money: 10_000 }}
        onExchange={() => {}}
      />,
    );

    expect(markup).toContain("grid-cols-[36px_repeat(14,100px)]");
    expect(markup).toContain("auto-rows-[26px]");
    expect(markup).toContain("text-[13px]");
    expect(markup.match(/data-exchange-cell="true"/g)).toHaveLength(14 * 28);
    expect(markup.match(/data-exchange-cell="true"[^>]*text-center/g)).toHaveLength(14 * 28);
    expect(markup).not.toContain("col-span-");
    expect(markup).not.toContain("bg-[#eaf2f8]");
    expect(markup).not.toContain("bg-[#fffdf2]");
    expect(markup.match(/bg-\[#eaf7ee\]/g)).toHaveLength(1);
    expect(markup).toMatch(/data-exchange-direction="coinToMoney"[^>]*>코인 → 머니<\/button><\/div><div data-exchange-cell="true"[^>]*><button type="button" data-exchange-direction="moneyToCoin"/);
  });

  it("gives the expected result its own non-wrapping cell", () => {
    const markup = renderToStaticMarkup(
      <ExchangeSheet
        wallet={{ coin: 300, money: 10_000 }}
        onExchange={() => {}}
      />,
    );

    expect(markup).toContain('data-exchange-field="preview-label"');
    expect(markup).toMatch(/data-exchange-field="preview-value"[^>]*whitespace-nowrap/);
  });
});
