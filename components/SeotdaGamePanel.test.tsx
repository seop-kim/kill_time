import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applySeotdaAction, createSeotdaGame } from "../lib/seotda";
import { SeotdaGamePanel } from "./SeotdaGamePanel";

describe("SeotdaGamePanel", () => {
  it("keeps the game surface inside spreadsheet cells and shows the current player's cards", () => {
    const game = createSeotdaGame(
      10_000,
      [
        { id: "p1", name: "하나", seat: 0 },
        { id: "p2", name: "둘", seat: 1 },
      ],
      100,
      () => 0.1,
    );
    const markup = renderToStaticMarkup(
      <SeotdaGamePanel
        game={game}
        playerId="p1"
        onAction={() => {}}
        participantMoney={{ p1: 12_345, p2: 6_789 }}
      />,
    );

    expect(markup).toContain("Up");
    expect(markup).toContain("10,000 money");
    expect(markup).toContain("현재 차례");
    expect(markup).not.toContain('data-seotda-field="timer-value"');
    expect(markup).toContain("내 패");
    expect(markup).toContain("삥");
    expect(markup).toContain("쿼터");
    expect(markup).toContain("하프");
    expect(markup).toContain("다이");
    expect(markup).toContain("grid-cols");
    expect(markup).toMatch(/data-seotda-field="stake-label"[^>]*col-span-2/);
    expect(markup).toMatch(/data-seotda-field="stake-value"[^>]*col-span-3/);
    expect(markup).toMatch(/data-seotda-field="pot-label"[^>]*col-span-2/);
    expect(markup).toMatch(/data-seotda-field="pot-value"[^>]*col-span-3/);
    expect(markup).toContain('data-seotda-field="own-stack"');
    expect(markup).toContain('data-seotda-field="own-bet"');
    expect(markup).toContain('data-seotda-field="own-rank"');
    expect(markup).toContain('data-seotda-field="player-name-p1"');
    expect(markup).toContain('data-seotda-field="player-money-p1"');
    expect(markup).toContain('data-seotda-field="player-remaining-p1"');
    expect(markup).toContain('data-seotda-field="player-bet-p1"');
    expect(markup).toContain('data-seotda-field="player-profile-card-p1"');
    expect(markup).toMatch(/data-seotda-field="player-profile-card-p1"[^>]*col-span-3[^>]*row-span-5/);
    expect(markup).toContain('data-seotda-field="player-name-p2"');
    expect(markup).toContain('data-seotda-field="player-profile-card-p2"');
    expect(markup).not.toContain('data-seotda-field="player-info-p1"');
    expect(markup).not.toContain(" · 스택 ");
    expect(markup).toContain('data-seotda-field="player-card-p1"');
    expect(markup).toContain('data-seotda-field="player-card-p2"');
    expect(markup).toContain('data-seotda-field="action-check"');
    expect(markup).toContain('data-seotda-field="action-quarter"');
    expect(markup).toContain('data-seotda-field="action-half"');
    expect(markup).toContain('data-seotda-field="pot-summary"');
    expect(markup).toContain("12,345");
    expect(markup).toContain("6,789");
  });

  it("shows the opponent's latest action and current pot", () => {
    const game = createSeotdaGame(
      100,
      [
        { id: "p1", name: "하나", seat: 0 },
        { id: "p2", name: "둘", seat: 1 },
      ],
      100,
      () => 0.1,
    );
    const afterAction = applySeotdaAction(game, "p1", "quarter", 101);
    const markup = renderToStaticMarkup(
      <SeotdaGamePanel game={afterAction} playerId="p2" onAction={() => {}} />,
    );

    expect(markup).toContain('data-seotda-field="last-action"');
    expect(markup).toContain("하나 · 쿼터 +25");
    expect(markup).toContain("현재 팟");
    expect(markup).toContain(">25</strong>");
  });

  it("enables the required response when the turn returns after an opponent bet", () => {
    const game = createSeotdaGame(
      100,
      [
        { id: "p1", name: "하나", seat: 0 },
        { id: "p2", name: "둘", seat: 1 },
      ],
      100,
      () => 0.1,
    );
    const afterFirstCheck = applySeotdaAction(game, "p1", "check", 101);
    const afterOpponentBet = applySeotdaAction(afterFirstCheck, "p2", "bet", 102);
    const markup = renderToStaticMarkup(
      <SeotdaGamePanel game={afterOpponentBet} playerId="p1" onAction={() => {}} />,
    );

    expect(markup).toContain("내 차례입니다.");
    expect(markup).toContain('data-seotda-field="action-help"');
    expect(markup).toContain("콜 금액 10");
    expect(markup).toMatch(/data-seotda-field="action-call"[^>]*><button type="button"(?! disabled)/);
  });

  it("renders a waiting message when no Seotda game has started", () => {
    const markup = renderToStaticMarkup(<SeotdaGamePanel game={null} playerId="p1" onAction={() => {}} />);

    expect(markup).toContain("방장이 게임을 시작하면 패가 배분됩니다.");
  });

  it("shows the finished result and a rematch action", () => {
    const game = createSeotdaGame(
      10_000,
      [
        { id: "p1", name: "하나", seat: 0 },
        { id: "p2", name: "둘", seat: 1 },
      ],
      10,
      () => 0.1,
    );
    const finishedGame = { ...game, status: "finished" as const, currentPlayerId: null, winnerIds: ["p1"] };
    const markup = renderToStaticMarkup(
      <SeotdaGamePanel
        game={finishedGame}
        playerId="p1"
        onAction={() => {}}
        onRematch={() => {}}
      />,
    );

    expect(markup).toContain('data-seotda-field="result"');
    expect(markup).toContain("승리했습니다");
    expect(markup).toContain('data-seotda-field="rematch"');
    expect(markup).toContain("다시 하기");
  });
});
