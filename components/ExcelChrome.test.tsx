import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AddinsMenuItems,
  CopilotButton,
  ExcelChrome,
  MatchParticipationPanel,
  ParticipantList,
  ProfileStatsDropdown,
  ShareDropdown,
  SettingsDropdown,
  StartGameConfirmDialog,
} from "./ExcelChrome";

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
        drawingColor="#e51c23"
        onDrawingColorChange={() => {}}
        drawingWidth={6}
        onDrawingWidthChange={() => {}}
      >
        <div>cell area</div>
      </ExcelChrome>,
    );

    expect(markup).toContain("flex items-start gap-1 self-center");
    expect(markup).toContain('aria-label="선색 선택"');
    expect(markup).toContain("#e51c23");
    expect(markup).toContain('aria-label="선 굵기"');
    expect(markup).toContain("6px");
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

  it("highlights the waiting status button when it can start a game", () => {
    const markup = renderToStaticMarkup(
      <ExcelChrome
        fileName="test.xlsx"
        avatars={[]}
        statusLabel="대기 중"
        onStatusClick={() => {}}
        onShare={() => {}}
        games={[{ id: "omok", label: "Omok", available: true }]}
        activeGameId="omok"
        onSelectGame={() => {}}
      >
        <div>cell area</div>
      </ExcelChrome>,
    );

    expect(markup).toContain("animate-pulse");
    expect(markup).toContain("bg-[#b7f3c2]");
  });

  it("shows a confirmation dialog before starting a game", () => {
    const markup = renderToStaticMarkup(
      <StartGameConfirmDialog open onConfirm={() => {}} onCancel={() => {}} />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("게임을 시작하시겠습니까?");
    expect(markup).toContain("시작");
    expect(markup).toContain("취소");
  });

  it("hides offline participants from the participant list", () => {
    const markup = renderToStaticMarkup(
      <ParticipantList
        participants={{
          players: [{ id: "online", name: "Online", color: "#217346", isTurn: false, online: true }],
          observers: [{ id: "offline", name: "Offline", color: "#777", isTurn: false, online: false }],
        }}
      />,
    );

    expect(markup).toContain("Online");
    expect(markup).not.toContain("Offline");
  });

  it("shows the current document code and copy action in the share menu", () => {
    const markup = renderToStaticMarkup(<ShareDropdown code="ABC123" onCopy={() => {}} />);

    expect(markup).toContain("현재 문서 코드");
    expect(markup).toContain("ABC123");
    expect(markup).toContain("복사하기");
  });

  it("shows game-specific records in the profile menu", () => {
    const markup = renderToStaticMarkup(
      <ProfileStatsDropdown
        name="Host"
        games={[{ id: "omok", label: "Omok", available: true }]}
        stats={{ omok: { played: 3, wins: 2, losses: 1, draws: 0 } }}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("Host님의 전적");
    expect(markup).toContain("Omok");
    expect(markup).toContain("2승");
    expect(markup).toContain("1패");
  });

  it("shows girin quiz records with its own metrics", () => {
    const markup = renderToStaticMarkup(
      <ProfileStatsDropdown
        name="Host"
        games={[{ id: "girin", label: "girin", available: true }]}
        stats={{ girin: { played: 2, wins: 1, losses: 1, draws: 0, totalQuizzes: 2, correctAnswers: 1, stumped: 1 } }}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("2퀴즈");
    expect(markup).toContain("1정답");
    expect(markup).toContain("1출제 성공");
  });

  it("shows raised hands and lets a participant join or leave the match queue", () => {
    const markup = renderToStaticMarkup(
      <MatchParticipationPanel
        participants={[
          { id: "host", name: "Host", role: "host" },
          { id: "guest-1", name: "Guest", role: "guest" },
        ]}
        requests={["host"]}
        myParticipantId="host"
        onToggle={() => {}}
      />,
    );

    expect(markup).toContain("대진 참여");
    expect(markup).toContain("Host");
    expect(markup).toContain("✋");
    expect(markup).toContain("대진 참여 취소");
  });
});
