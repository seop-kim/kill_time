"use client";

import { FormEvent, useState } from "react";
import { normalizeNumberBaseballGuess, type NumberBaseballGame } from "../lib/numberBaseball";

function formatFeedback(feedback: { strikes: number; balls: number; outs: number }): string {
  return `${feedback.strikes}S ${feedback.balls}B ${feedback.outs}O`;
}

export function NumberBaseballGamePanel({
  game,
  playerId,
  onGuess,
}: {
  game: NumberBaseballGame | null;
  playerId: string;
  onGuess: (guess: string) => void;
}) {
  const [guess, setGuess] = useState("");
  const [inputError, setInputError] = useState("");

  if (!game) {
    return (
      <div data-number-baseball-grid="true" className="h-full min-w-[1260px] bg-white p-4 text-[12px] text-[#333]">
        <div className="grid h-[118px] grid-cols-12 border border-[#b7c9dc]">
          <div className="col-span-3 flex items-center border-r border-[#b7c9dc] bg-[#f2f6fb] px-3 font-semibold">숫자야구</div>
          <div className="col-span-9 flex items-center px-3">방장이 시작하면 순번이 무작위로 정해집니다. (2~3명)</div>
        </div>
      </div>
    );
  }

  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : undefined;
  const isMyTurn = game.status === "playing" && game.currentPlayerId === playerId;
  const winner = game.winnerId ? game.players[game.winnerId] : undefined;

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeNumberBaseballGuess(guess);
    if (!normalized) {
      setInputError("서로 다른 숫자 3개를 입력해 주세요.");
      return;
    }
    setInputError("");
    setGuess("");
    onGuess(normalized);
  }

  return (
    <div data-number-baseball-grid="true" className="h-full min-w-[1260px] overflow-auto bg-white text-[12px] text-[#333]">
      <div className="grid min-h-[620px] grid-cols-12 auto-rows-[36px] border-l border-t border-[#b7c9dc]">
        <div className="col-span-3 row-span-2 flex items-center border-b border-r border-[#b7c9dc] bg-[#f2f6fb] px-3 text-[14px] font-semibold">숫자야구</div>
        <div className="col-span-3 border-b border-r border-[#b7c9dc] px-3 py-2">참여 인원</div>
        <div className="col-span-6 border-b border-r border-[#b7c9dc] px-3 py-2">2~3명 · 최대 3명 · 순서 랜덤</div>
        <div className="col-span-3 border-b border-r border-[#b7c9dc] px-3 py-2">라운드</div>
        <div className="col-span-3 border-b border-r border-[#b7c9dc] px-3 py-2">{game.round}/{game.maxRounds}</div>
        <div className="col-span-3 border-b border-r border-[#b7c9dc] px-3 py-2">현재 차례</div>
        <div className="col-span-3 border-b border-r border-[#b7c9dc] px-3 py-2 font-semibold">{currentPlayer?.name ?? "-"}</div>

        {game.turnOrder.map((id) => {
          const player = game.players[id];
          if (!player) return null;
          const isTurn = game.status === "playing" && game.currentPlayerId === id;
          return (
            <div key={id} data-number-baseball-player={id} className={`col-span-4 row-span-2 border-b border-r border-[#b7c9dc] p-2 ${isTurn ? "bg-[#eaf7ee]" : "bg-white"}`}>
              <div className="flex items-center justify-between border-b border-[#d9e2f3] pb-1">
                <span className="font-semibold">{player.name}</span>
                <span className="text-[10px] text-[#777]">{isTurn ? "입력 차례" : "대기"}</span>
              </div>
              <div className="pt-2 text-[11px] text-[#555]">{id === playerId ? "나" : "참여자"}</div>
            </div>
          );
        })}

        <div className="col-span-12 row-span-2 border-b border-r border-[#b7c9dc] bg-[#fafafa] px-3 py-2">
          {game.status === "finished" ? (
            <div data-number-baseball-field="result" className="text-[14px] font-semibold text-[#217346]">
              {winner ? `${winner.name}님이 승리했습니다.` : "이번 숫자야구는 무승부입니다."}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span>{isMyTurn ? "내 차례입니다." : `${currentPlayer?.name ?? "상대방"}님의 입력을 기다리는 중입니다.`}</span>
              <span className="text-[10px] text-[#777]">턴 제한 30초 · 최대 5라운드</span>
            </div>
          )}
        </div>

        <div className="col-span-8 row-span-6 border-b border-r border-[#b7c9dc] p-3">
          <div className="mb-2 border-b border-[#d9e2f3] pb-2 font-semibold">입력 기록</div>
          {game.guesses.length === 0 ? (
            <div className="text-[11px] text-[#777]">아직 입력 기록이 없습니다.</div>
          ) : (
            <div className="max-h-[180px] overflow-auto">
              {game.guesses.map((entry, index) => (
                <div key={`${entry.at}-${entry.playerId}-${index}`} className="grid grid-cols-[70px_1fr_90px] border-b border-[#edf1f6] py-1 text-[11px]">
                  <span>{entry.playerName}</span><span className="font-mono tracking-[0.2em]">{entry.guess}</span><span className="text-right">{formatFeedback(entry.feedback)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-4 row-span-6 border-b border-r border-[#b7c9dc] p-3">
          <div className="mb-2 border-b border-[#d9e2f3] pb-2 font-semibold">정답 입력</div>
          <form onSubmit={submitGuess} className="flex flex-col gap-2">
            <input
              aria-label="숫자야구 입력"
              value={guess}
              onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, 3))}
              disabled={!isMyTurn}
              inputMode="numeric"
              maxLength={3}
              placeholder="숫자 3개"
              className="h-9 border border-[#b7c9dc] px-2 font-mono tracking-[0.2em] outline-none focus:border-[#217346] disabled:bg-[#f5f5f5]"
            />
            <button type="submit" disabled={!isMyTurn} className="h-8 border border-[#217346] bg-[#eaf7ee] text-[#217346] hover:bg-[#d9f0e2] disabled:cursor-not-allowed disabled:opacity-50">입력하기</button>
            {inputError ? <span className="text-[10px] text-[#c0392b]">{inputError}</span> : <span className="text-[10px] text-[#777]">숫자는 중복될 수 없습니다.</span>}
          </form>
        </div>
      </div>
    </div>
  );
}
