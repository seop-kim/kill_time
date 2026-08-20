import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChatPanel,
  TextSizeMenu,
  getChatUserColorMap,
  getChatUserKey,
  getChatUserColor,
  normalizeChatTextSize,
  normalizeChatWidth,
} from "./ChatPanel";

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

  it("assigns 15 distinct colors in participant order and rotates on the 16th", () => {
    const messages = Array.from({ length: 16 }, (_, index) => ({
      by: "spectator" as const,
      participantId: `user-${index + 1}`,
      name: `참가자 ${index + 1}`,
      text: "메시지",
      at: index,
    }));
    const colors = getChatUserColorMap(messages);
    const firstFifteen = messages.slice(0, 15).map((message) => colors.get(getChatUserKey(message)));

    expect(new Set(firstFifteen.map((color) => color?.accent)).size).toBe(15);
    expect(colors.get(getChatUserKey(messages[15]))).toEqual(colors.get(getChatUserKey(messages[0])));
  });

  it("keeps the same color when a participant sends another message", () => {
    const firstMessage = { by: "host" as const, participantId: "user-1", name: "같은 이름", text: "첫 메시지", at: 1 };
    const secondMessage = { by: "guest" as const, participantId: "user-2", name: "다른 이름", text: "두 번째 메시지", at: 2 };
    const repeatedMessage = { ...firstMessage, text: "다시 보냅니다", at: 3 };
    const colors = getChatUserColorMap([firstMessage, secondMessage, repeatedMessage]);

    expect(colors.get(getChatUserKey(firstMessage))).toEqual(colors.get(getChatUserKey(repeatedMessage)));
  });

  it("applies user colors to chat messages", () => {
    const messages = [
      { by: "host" as const, participantId: "host-id", name: "Host", text: "안녕", at: 1 },
      { by: "guest" as const, participantId: "guest-id", name: "Guest", text: "반가워", at: 2 },
    ];
    const colors = getChatUserColorMap(messages);
    const hostColor = colors.get(getChatUserKey(messages[0])) ?? getChatUserColor(0);
    const guestColor = colors.get(getChatUserKey(messages[1])) ?? getChatUserColor(1);
    const markup = renderToStaticMarkup(
      <ChatPanel
        open
        messages={messages}
        myRole="host"
        onClose={() => {}}
        onSend={() => {}}
      />,
    );

    expect(markup).toContain(hostColor.accent);
    expect(markup).toContain(hostColor.surface);
    expect(markup).toContain(guestColor.accent);
  });
});
