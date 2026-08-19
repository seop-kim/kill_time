import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPanel, TextSizeMenu, normalizeChatTextSize, normalizeChatWidth } from "./ChatPanel";

describe("ChatPanel", () => {
  it("shows an explicit send button for chat messages", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toMatch(/<button[^>]*>보내기<\/button>/);
  });

  it("stays inside the cell area instead of being fixed to the viewport", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toMatch(/\babsolute\b/);
    expect(markup).toMatch(/\bright-0\b/);
    expect(markup).toMatch(/\btop-0\b/);
    expect(markup).toMatch(/\bbottom-0\b/);
    expect(markup).not.toMatch(/\bfixed\b/);
  });

  it("keeps a fixed FHD width instead of shrinking for smaller viewports", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toContain("w-[320px]");
    expect(markup).not.toMatch(/\bmax-w-full\b/);
  });

  it("uses 8px as the default chat text size", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toContain('style="font-size:8px"');
  });

  it("opens a px text size input from the more menu", () => {
    const markup = renderToStaticMarkup(
      <TextSizeMenu value={15} onChange={() => {}} onClose={() => {}} />,
    );

    expect(markup).toContain('role="menu"');
    expect(markup).toContain("텍스트 크기");
    expect(markup).toContain('type="number"');
    expect(markup).toContain('value="15"');
    expect(markup).toContain('min="1"');
    expect(markup).toContain('max="24"');
    expect(markup).toContain("px");
    expect(markup).not.toContain("작게");
    expect(markup).not.toContain("보통");
    expect(markup).not.toContain("크게");
  });

  it("keeps custom text size within the supported px range", () => {
    expect(normalizeChatTextSize(0)).toBe(1);
    expect(normalizeChatTextSize(1)).toBe(1);
    expect(normalizeChatTextSize(18.6)).toBe(19);
    expect(normalizeChatTextSize(30)).toBe(24);
    expect(normalizeChatWidth(250)).toBe(260);
    expect(normalizeChatWidth(320)).toBe(320);
    expect(normalizeChatWidth(500)).toBe(480);
  });

  it("exposes the more menu button in the chat toolbar", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toContain('aria-label="채팅 옵션"');
  });

  it("provides a mouse drag handle for resizing the chat width", () => {
    const markup = renderToStaticMarkup(
      <ChatPanel open messages={[]} myRole="host" onClose={() => {}} onSend={() => {}} />,
    );

    expect(markup).toContain('aria-label="채팅창 너비 조절"');
    expect(markup).toContain('aria-valuenow="320"');
    expect(markup).toContain("cursor-ew-resize");
  });
});
