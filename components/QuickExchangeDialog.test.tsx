import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuickExchangeDialog } from "./QuickExchangeDialog";

describe("QuickExchangeDialog", () => {
  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      <QuickExchangeDialog
        open={false}
        wallet={{ coin: 10, money: 0 }}
        requiredMoney={1_000}
        busy={false}
        confirmLabel="교환하고 입장"
        onClose={() => {}}
        onExchange={() => {}}
      />,
    );

    expect(markup).toBe("");
  });

  it("suggests just enough coin to cover the shortfall and previews the result", () => {
    const markup = renderToStaticMarkup(
      <QuickExchangeDialog
        open
        wallet={{ coin: 50, money: 300 }}
        requiredMoney={1_000}
        busy={false}
        confirmLabel="교환하고 입장"
        onClose={() => {}}
        onExchange={() => {}}
      />,
    );

    // Shortfall is 700 money, which needs ceil(700/100) = 7 coin.
    expect(markup).toMatch(/id="quick-exchange-amount"[^>]*value="7"/);
    expect(markup).toContain("1,000");
    expect(markup).toContain("300");
    expect(markup).toContain("50");
    // 300 + 7 * 100 = 1,000 previewed money.
    expect(markup).toMatch(/data-quick-exchange-field="preview"[^>]*>[\s\S]*?1,000/);
    expect(markup).not.toContain("코인이 부족합니다");
    expect(markup).toContain("교환하고 입장");
  });

  it("flags when the wallet doesn't have enough coin for the suggested amount", () => {
    const markup = renderToStaticMarkup(
      <QuickExchangeDialog
        open
        wallet={{ coin: 2, money: 0 }}
        requiredMoney={1_000}
        busy={false}
        confirmLabel="교환하고 입장"
        onClose={() => {}}
        onExchange={() => {}}
      />,
    );

    expect(markup).toContain("코인이 부족합니다");
    expect(markup).toMatch(/type="submit"[^>]*disabled/);
  });
});
