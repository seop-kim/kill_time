import { evaluateSeotdaHand, getLegalSeotdaActions, type SeotdaActionType, type SeotdaGame } from "../lib/seotda";

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

const ACTION_LABELS: Record<SeotdaActionType, string> = {
  check: "체크",
  bet: "삥",
  quarter: "쿼터",
  half: "하프",
  call: "콜",
  raise: "레이즈",
  "all-in": "올인",
  fold: "다이",
};

function statusLabel(game: SeotdaGame): string {
  if (game.status === "finished") return "게임 종료";
  if (game.status === "showdown") return "족보 확인 중";
  return `${game.round}차 베팅`;
}

function resultLabel(game: SeotdaGame, playerId: string): string {
  const winnerIds = game.winnerIds ?? [];
  const winnerNames = winnerIds
    .map((id) => game.players[id]?.name)
    .filter((name): name is string => Boolean(name));

  if (winnerIds.length > 1) return "무승부입니다.";
  if (winnerIds.includes(playerId)) return "승리했습니다!";
  return `${winnerNames[0] ?? "상대방"}님이 승리했습니다.`;
}

export function SeotdaGamePanel({
  game,
  playerId,
  onAction,
  onRematch,
  participantMoney = {},
}: {
  game: SeotdaGame | null;
  playerId: string;
  onAction: (action: SeotdaActionType) => void;
  onRematch?: () => void;
  participantMoney?: Record<string, number>;
}) {
  const player = game?.players[playerId];
  const legalActions = game ? getLegalSeotdaActions(game, playerId) : [];
  const players = game ? Object.values(game.players).sort((a, b) => a.seat - b.seat) : [];
  const isMyTurn = Boolean(game && game.currentPlayerId === playerId);
  const ownRank = player?.hand.length === 2 ? evaluateSeotdaHand(player.hand as [typeof player.hand[number], typeof player.hand[number]]) : null;

  const ownHand = player?.hand ?? [];
  const actionTypes: SeotdaActionType[] = ["check", "bet", "quarter", "half", "call", "raise", "all-in", "fold"];
  const winnerNames = game?.winnerIds?.map((id) => game.players[id]?.name).filter(Boolean).join(", ") ?? "";
  const participantRows = Array.from({ length: 2 }, (_, rowIndex) => players.slice(rowIndex * 4, rowIndex * 4 + 4));
  const lastAction = game?.lastAction;
  const lastActionName = lastAction ? game.players[lastAction.playerId]?.name ?? "상대방" : "";
  const lastActionText = lastAction
    ? `${lastActionName} · ${ACTION_LABELS[lastAction.action]}${lastAction.amount > 0 ? ` +${formatAmount(lastAction.amount)}` : ""}`
    : "아직 액션 없음";
  const toCall = game && player ? Math.max(0, game.currentBet - player.committed) : 0;
  const legalActionText = legalActions.map((action) => ACTION_LABELS[action]).join(" · ");
  const actionHelp = !game
    ? "게임 시작 후 선택할 수 있습니다."
    : !isMyTurn
      ? "상대방의 선택을 기다리는 중입니다."
      : toCall > 0
        ? `콜 금액 ${formatAmount(toCall)} · ${legalActionText}`
        : `선택 가능 · ${legalActionText}`;

  const participantCard = (participant: typeof players[number]) => {
    const isSelf = participant.id === playerId;
    const visibleCards = isSelf ? participant.hand : Array.from({ length: Math.max(1, participant.hand.length) }, () => null);
    const isCurrent = participant.id === game?.currentPlayerId;
    const walletMoney = participantMoney[participant.id];
    const totalMoney = walletMoney == null ? null : walletMoney + participant.stack;

    return (
      <div
        key={participant.id}
        data-seotda-field={`player-profile-card-${participant.id}`}
        className={`col-span-3 row-span-4 grid min-w-0 grid-cols-3 grid-rows-4 overflow-hidden border-2 bg-white ${isCurrent ? "border-[#217346]" : "border-[#b7c9e2]"}`}
      >
        <div className="min-w-0 overflow-hidden border border-[#e8edf3] bg-[#f8f8f8] px-1 py-1 text-[10px] text-[#789]">닉네임</div>
        <div data-seotda-field={`player-name-${participant.id}`} className={`col-span-2 min-w-0 overflow-hidden border border-[#e8edf3] bg-white px-1 py-1 font-semibold ${isCurrent ? "text-[#217346]" : "text-[#333]"}`} title={participant.name}>
          <span className="block truncate">{participant.name}{isCurrent ? " ◀" : ""}</span>
        </div>
        <div className="min-w-0 overflow-hidden border border-[#e8edf3] bg-[#f8f8f8] px-1 py-1 text-[10px] text-[#789]">머니</div>
        <div data-seotda-field={`player-money-${participant.id}`} className="col-span-2 min-w-0 overflow-hidden border border-[#e8edf3] bg-white px-1 py-1 font-semibold text-[#333]"><span className="block truncate">{totalMoney == null ? "-" : formatAmount(totalMoney)}</span></div>
        <div className="min-w-0 overflow-hidden border border-[#e8edf3] bg-[#f8f8f8] px-1 py-1 text-[10px] text-[#789]">베팅금액</div>
        <div data-seotda-field={`player-bet-${participant.id}`} className="col-span-2 min-w-0 overflow-hidden border border-[#e8edf3] bg-white px-1 py-1 font-semibold text-[#333]"><span className="block truncate">{formatAmount(participant.committed)}</span></div>
        <div className="min-w-0 overflow-hidden border border-[#e8edf3] bg-[#f8f8f8] px-1 py-1 text-[10px] text-[#789]">패</div>
        <div data-seotda-field={`player-card-${participant.id}`} className="col-span-2 min-w-0 overflow-hidden border border-[#e8edf3] bg-white px-1 py-1 text-center">
          {visibleCards.map((card, index) => (
            <span key={`${participant.id}-card-${index}`} className="mr-1 inline-block rounded-sm border border-[#b7c9e2] bg-[#f3f8fc] px-1 py-0.5 font-semibold text-[#1f4e79]">
              {card ? `${card.value}${card.isGwang ? "광" : "월"}` : "패"}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const emptyParticipantCards = (rowIndex: number) => Array.from(
    { length: 4 - participantRows[rowIndex].length },
    (_, participantIndex) => <div key={`empty-participant-${rowIndex}-${participantIndex}`} className="col-span-3 row-span-4 border-2 border-[#e8edf3] bg-white" />,
  );

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="grid min-h-full grid-cols-[40px_repeat(12,110px)] auto-rows-[34px] text-[11px]">
        <div className="sticky left-0 top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2]" />
        {Array.from({ length: 12 }, (_, index) => (
          <div key={`column-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
            {String.fromCharCode(65 + index)}
          </div>
        ))}

        <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
        <div data-seotda-field="game-title" className="col-span-2 min-w-0 border border-[#b7c9e2] bg-[#eaf2f8] px-2 py-1 font-semibold text-[#1f4e79]">Up</div>
        <div data-seotda-field="stake-label" className="col-span-2 min-w-0 border border-[#d9e2f3] bg-[#fffdf2] px-2 py-1 text-[#7f6000]">판돈</div>
        <div data-seotda-field="stake-value" className="col-span-3 min-w-0 border border-[#d9e2f3] bg-[#fffdf2] px-2 py-1 font-semibold whitespace-nowrap text-[#333]">{game ? `${formatAmount(game.stake)} money` : "-"}</div>
        <div data-seotda-field="pot-label" className="col-span-2 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 text-[#555]">팟</div>
        <div data-seotda-field="pot-value" className="col-span-3 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 font-semibold whitespace-nowrap text-[#333]">{game ? formatAmount(game.pot) : "-"}</div>

        <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
        {game ? (
          <>
            <div data-seotda-field="status" className="col-span-3 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 font-semibold whitespace-nowrap text-[#333]">{statusLabel(game)}</div>
            <div data-seotda-field="current-turn-label" className="col-span-2 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">현재 차례</div>
            <div data-seotda-field="current-turn-value" className="col-span-7 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 font-semibold whitespace-nowrap text-[#333]">{game.currentPlayerId ? game.players[game.currentPlayerId]?.name ?? "-" : "-"}</div>
          </>
        ) : (
          <>
            <div data-seotda-field="status" className="col-span-3 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 font-semibold whitespace-nowrap text-[#333]">대기 중</div>
            <div data-seotda-field="waiting-message" className="col-span-9 min-w-0 border border-[#d9e2f3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">방장이 게임을 시작하면 패가 배분됩니다.</div>
          </>
        )}

        <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">3</div>
        <div data-seotda-field="own-hand" className="col-span-6 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">
          <span className="mr-1">내 패</span>
          {ownHand.length > 0 ? ownHand.map((card, index) => (
            <span key={`own-card-${index}`} className="mr-1 inline-block rounded-sm border border-[#b7c9e2] bg-[#f3f8fc] px-1 font-semibold text-[#1f4e79]">{`${card.value}${card.isGwang ? "광" : "월"}`}</span>
          )) : <span>-</span>}
        </div>
        <div data-seotda-field="own-bet" className="col-span-3 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">내 베팅금액 <strong className="text-[#333]">{formatAmount(player?.committed ?? 0)}</strong></div>
        <div data-seotda-field="own-rank" className="col-span-3 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">족보 <strong className="text-[#1f4e79]">{ownRank?.label ?? "-"}</strong></div>

        <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">4</div>
        {participantRows[0].map(participantCard)}
        {emptyParticipantCards(0)}

        {Array.from({ length: 3 }, (_, row) => <div key={`participant-row-label-a-${row}`} className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{row + 5}</div>)}
        <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">8</div>
        {participantRows[1].map(participantCard)}
        {emptyParticipantCards(1)}

        {Array.from({ length: 3 }, (_, row) => <div key={`participant-row-label-b-${row}`} className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{row + 9}</div>)}

        <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">12</div>
        {actionTypes.map((action) => (
          <div key={action} data-seotda-field={`action-${action}`} className="col-span-1 min-w-0 border border-[#e8edf3] bg-white p-1">
            <button
              type="button"
              disabled={!legalActions.includes(action)}
              onClick={() => onAction(action)}
              className="h-full w-full border border-[#b7c9e2] bg-white px-1 text-[11px] whitespace-nowrap text-[#333] hover:bg-[#eaf2f8] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {ACTION_LABELS[action]}
            </button>
          </div>
        ))}
        <div data-seotda-field="turn-message" className="col-span-4 min-w-0 overflow-hidden border border-[#e8edf3] bg-white px-2 py-0.5 whitespace-nowrap text-[#777]">
          <div>{isMyTurn ? "내 차례입니다." : "상대방 차례입니다."}</div>
          <div data-seotda-field="action-help" className="truncate text-[9px] text-[#217346]">{actionHelp}</div>
        </div>

        <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">13</div>
        {game?.status === "finished" ? (
          <>
            <div data-seotda-field="result" className="col-span-8 min-w-0 border border-[#d6c27a] bg-[#fff9df] px-2 py-1 font-semibold whitespace-nowrap text-[#7f6000]">{resultLabel(game, playerId)}</div>
            <div data-seotda-field="winner" className="col-span-2 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[10px] text-[#555]">승자 {winnerNames || "-"}</div>
            <div data-seotda-field="rematch" className="col-span-2 min-w-0 border border-[#e8edf3] bg-white p-1">
              {onRematch ? (
                <button type="button" onClick={onRematch} className="h-full w-full border border-[#217346] bg-[#217346] px-1 text-[11px] whitespace-nowrap text-white hover:bg-[#1a5c38]">다시 하기</button>
              ) : (
                <span className="block px-1 py-1 text-center text-[10px] whitespace-nowrap text-[#777]">방장 재시작 대기</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div data-seotda-field="last-action" className="col-span-8 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">
              최근 액션 <strong className="ml-1 font-semibold text-[#333]">{lastActionText}</strong>
            </div>
            <div data-seotda-field="pot-summary" className="col-span-4 min-w-0 border border-[#e8edf3] bg-white px-2 py-1 whitespace-nowrap text-[#555]">
              현재 팟 <strong className="ml-1 font-semibold text-[#333]">{formatAmount(game?.pot ?? 0)}</strong>
            </div>
          </>
        )}

        {Array.from({ length: 7 }, (_, row) => (
          <div key={`row-${row}`} className="contents">
            <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{row + 14}</div>
            {Array.from({ length: 12 }, (_, column) => <div key={`cell-${row}-${column}`} className="border border-[#e8edf3] bg-white" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
