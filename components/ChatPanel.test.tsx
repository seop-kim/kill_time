import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPanel } from "./ChatPanel";

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
});
