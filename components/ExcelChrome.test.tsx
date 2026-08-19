import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddinsMenuItems, CopilotButton, ExcelChrome, ParticipantList, SettingsDropdown } from "./ExcelChrome";

describe("ExcelChrome", () => {
  function renderChrome() {
    return renderToStaticMarkup(
      <ExcelChrome
        fileName="test.xlsx"
        avatars={[]}
        onShare={() => {}}
        games={[{ id: "omok", label: "Omok", available: true }]}
        activeGameId="omok"
        onSelectGame={() => {}}
      >
        <div>cell area</div>
      </ExcelChrome>,
    );
  }

  it("pins the spreadsheet frame to the viewport so its footer stays at the bottom", () => {
    const markup = renderChrome();
    const rootClass = markup.match(/^<div class="([^"]+)/)?.[1] ?? "";

    expect(rootClass).toMatch(/\bfixed\b/);
    expect(rootClass).toMatch(/\boverflow-hidden\b/);
    expect(rootClass).not.toMatch(/\bh-screen\b/);
    expect(markup).toContain("통합 문서 통계");
  });

  it("keeps a fixed FHD canvas so narrow windows clip instead of reflowing the chrome", () => {
    const markup = renderChrome();
    const rootClass = markup.match(/^<div class="([^\"]+)/)?.[1] ?? "";

    expect(rootClass).toContain("min-w-[1280px]");
    expect(rootClass).toMatch(/\bbottom-0\b/);
    expect(rootClass).not.toMatch(/\bh-\[720px\]\b/);
    expect(rootClass).not.toMatch(/\bmin-h-\[720px\]\b/);
    expect(rootClass).toMatch(/(^| )w-\[1280px\]( |$)/);
  });

  it("keeps the ribbon at a fixed FHD width without responsive scrolling", () => {
    const markup = renderChrome();

    expect(markup).toContain("w-[340px]");
    expect(markup).not.toContain("max-w-full");
    expect(markup).not.toContain("overflow-x-auto");
  });

  it("keeps both settings actions inside one vertical dropdown", () => {
    const markup = renderToStaticMarkup(
      <SettingsDropdown onStartGame={() => {}} onRestart={() => {}} onLeave={() => {}} />,
    );

    expect(markup).toContain("flex flex-col items-stretch");
    expect(markup).toContain("게임 시작");
    expect(markup.indexOf("게임 다시 시작")).toBeLessThan(markup.indexOf("방 나가기"));
  });

  it("places the Copilot launcher beside Add-ins", () => {
    const markup = renderToStaticMarkup(<CopilotButton onClick={() => {}} />);

    expect(markup).toContain('aria-label="코파일럿 열기"');
    expect(markup).toContain("코파일럿");
    expect(markup).toContain("copilot-icon.png");
    expect(markup).toContain("w-[58px]");
    expect(markup).toContain("h-[42px]");
    expect(markup).toContain("justify-center");
  });

  it("centers Add-ins and Copilot with the sensitivity control", () => {
    const markup = renderToStaticMarkup(
      <ExcelChrome
        fileName="test.xlsx"
        avatars={[]}
        onShare={() => {}}
        games={[{ id: "omok", label: "Omok", available: true }]}
        activeGameId="omok"
        onSelectGame={() => {}}
        onOpenChat={() => {}}
      >
        <div>cell area</div>
      </ExcelChrome>,
    );

    expect(markup).toContain("flex items-start gap-1 self-center");
  });

  it("keeps chat out of the Add-ins menu", () => {
    const markup = renderToStaticMarkup(
      <AddinsMenuItems onRequestUndo={() => {}} onRequestDraw={() => {}} onClose={() => {}} />,
    );

    expect(markup).not.toContain("채팅");
    expect(markup).toContain("한 수 무르기");
    expect(markup).toContain("무승부 요청");
  });

  it("renders the current collaboration status and participant groups", () => {
    const markup = renderToStaticMarkup(
      <ExcelChrome
        fileName="test.xlsx"
        avatars={[{ id: "host", name: "Host", color: "#217346", isTurn: false }]}
        participants={{
          players: [{ id: "host", name: "Host", color: "#217346", isTurn: false }],
          observers: [{ id: "observer", name: "Observer", color: "#777", isTurn: false }],
        }}
        statusLabel="대기 중"
        onShare={() => {}}
        games={[{ id: "omok", label: "Omok", available: true }]}
        activeGameId="omok"
        onSelectGame={() => {}}
      >
        <div>cell area</div>
      </ExcelChrome>,
    );

    const participantMarkup = renderToStaticMarkup(
      <ParticipantList
        participants={{
          players: [{ id: "host", name: "Host", color: "#217346", isTurn: false }],
          observers: [{ id: "observer", name: "Observer", color: "#777", isTurn: false }],
        }}
      />,
    );

    expect(markup).toContain("대기 중");
    expect(participantMarkup).toContain("게임 중");
    expect(participantMarkup).toContain("옵저버");
    expect(participantMarkup).toContain("Observer");
  });
});
