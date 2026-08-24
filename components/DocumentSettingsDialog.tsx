"use client";

import { SEOTDA_STAKE_MAX, SEOTDA_STAKE_MIN } from "../lib/economy";
import type { RoomGameId } from "../lib/rooms";

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function DocumentSettingsDialog({
  open,
  title,
  gameId,
  moneyStake,
  submitLabel,
  busy = false,
  onGameChange,
  onMoneyStakeChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  gameId: RoomGameId;
  moneyStake: number;
  submitLabel: string;
  busy?: boolean;
  onGameChange: (gameId: RoomGameId) => void;
  onMoneyStakeChange: (moneyStake: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="document-settings-title" className="w-[420px] rounded-sm border border-[#d0d0d0] bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-3">
          <h2 id="document-settings-title" className="text-[14px] font-semibold text-[#333]">{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="text-[20px] leading-none text-[#777] hover:text-[#333]">
            ×
          </button>
        </div>

        <form
          className="flex flex-col gap-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#555]">게임 선택</span>
            <select
              aria-label="게임 선택"
              value={gameId}
              onChange={(event) => onGameChange(event.target.value as RoomGameId)}
              className="h-[30px] rounded-sm border border-[#c8c8c8] bg-white px-2 text-[12px] outline-none focus:border-[#217346]"
            >
              <option value="omok">오목</option>
              <option value="girin">내가 그린 기린 그림</option>
              <option value="seotda">Up</option>
              <option value="minesweeper">지뢰찾기</option>
            </select>
          </label>

          {gameId === "seotda" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#555]">판돈 (머니)</span>
              <input
                aria-label="Up 판돈"
                type="number"
                min={SEOTDA_STAKE_MIN}
                max={SEOTDA_STAKE_MAX}
                step={1}
                value={moneyStake}
                onChange={(event) => onMoneyStakeChange(Number(event.target.value))}
                className="h-[30px] rounded-sm border border-[#c8c8c8] px-2 text-[12px] outline-none focus:border-[#217346]"
              />
              <span className="text-[10px] text-[#777]">
                {formatAmount(SEOTDA_STAKE_MIN)}~{formatAmount(SEOTDA_STAKE_MAX)}머니 · 모든 참여자의 잔액이 판돈 이상이어야 시작됩니다.
              </span>
              <span className="text-[10px] text-[#217346]">현재 판돈 {formatAmount(moneyStake)} money</span>
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-[#c8c8c8] px-3 py-1.5 text-[12px] text-[#555] hover:bg-[#f5f5f5]">
              취소
            </button>
            <button type="submit" disabled={busy} className="rounded-sm bg-[#217346] px-3 py-1.5 text-[12px] text-white hover:bg-[#1a5c38] disabled:opacity-60">
              {busy ? "저장 중..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
