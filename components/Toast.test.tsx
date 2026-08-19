import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type ToastCardProps = { message: string; variant: "info" | "error"; onClose: () => void; emphasis?: boolean };
type ToastCardComponent = (props: ToastCardProps) => ReactNode;

describe("ToastCard", () => {
  it("uses a larger readable card for toast messages", async () => {
    const toastModule = await import("./Toast");
    const ToastCard = (toastModule as Record<string, unknown>).ToastCard;

    expect(typeof ToastCard).toBe("function");
    if (typeof ToastCard !== "function") return;

    const markup = renderToStaticMarkup(
      createElement(ToastCard as ToastCardComponent, {
        message: "저장되었습니다.",
        variant: "info",
        onClose: () => {},
      }),
    );

    expect(markup).toMatch(/\bw-80\b/);
    expect(markup).toMatch(/text-\[14px\]/);
    expect(markup).toMatch(/py-2\.5/);
    expect(markup).toMatch(/px-4/);
    expect(markup).toContain('aria-label="토스트 닫기"');
    expect(markup).toContain(">×</button>");
  });

  it("uses an emphasized card for game results", async () => {
    const toastModule = await import("./Toast");
    const ToastCard = (toastModule as Record<string, unknown>).ToastCard;

    expect(typeof ToastCard).toBe("function");
    if (typeof ToastCard !== "function") return;

    const markup = renderToStaticMarkup(
      createElement(ToastCard as ToastCardComponent, {
        message: "승리했습니다!",
        variant: "info",
        emphasis: true,
        onClose: () => {},
      }),
    );

    expect(markup).toContain("w-[420px]");
    expect(markup).toContain("text-[18px]");
  });
});
