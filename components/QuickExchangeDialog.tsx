"use client";

import { useState } from "react";
import { COIN_TO_MONEY_RATE } from "../lib/economy";
import type { WalletProfile } from "../lib/wallet";

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function QuickExchangeDialog({
  open,
  wallet,
  requiredMoney,
  busy,
  confirmLabel,
  onClose,
  onExchange,
}: {
  open: boolean;
  wallet: WalletProfile;
  requiredMoney: number;
  busy: boolean;
  confirmLabel: string;
  onClose: () => void;
  onExchange: (coinAmount: number) => void;
}) {
  const shortfall = Math.max(0, requiredMoney - wallet.money);
  const suggestedCoin = Math.max(1, Math.ceil(shortfall / COIN_TO_MONEY_RATE));
  const [coinAmount, setCoinAmount] = useState(String(suggestedCoin));
  // Re-seed the input each time the dialog opens for a (possibly new)
  // shortfall, without a useEffect: adjust state directly during render.
  const seedKey = `${open}:${suggestedCoin}`;
  const [lastSeedKey, setLastSeedKey] = useState(seedKey);
  if (open && seedKey !== lastSeedKey) {
    setLastSeedKey(seedKey);
    setCoinAmount(String(suggestedCoin));
  }

  if (!open) return null;

  const numericCoin = Number(coinAmount);
  const validCoin = Number.isInteger(numericCoin) && numericCoin > 0;
  const previewMoney = validCoin ? wallet.money + numericCoin * COIN_TO_MONEY_RATE : wallet.money;
  const enoughCoin = wallet.coin >= numericCoin;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="quick-exchange-title" className="w-[384px] bg-white border border-[#d0d0d0] rounded-sm shadow-lg">
        <div className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-3">
          <h2 id="quick-exchange-title" className="text-[15px] font-semibold text-[#333]">
            머니 부족
          </h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="text-[20px] leading-none text-[#777] hover:text-[#333]">
            ×
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validCoin) onExchange(numericCoin);
          }}
          className="px-5 py-4 flex flex-col gap-4"
        >
          <p className="text-[13px] text-[#555]">
            판돈 <strong className="text-[#333]">{formatAmount(requiredMoney)}</strong>머니가 필요한데 보유 머니는{" "}
            <strong className="text-[#333]">{formatAmount(wallet.money)}</strong>입니다. 코인을 머니로 교환하고 입장하세요.
          </p>

          <div className="flex justify-between text-[12px] text-[#555]">
            <span>보유 코인 <strong className="text-[#333]">{formatAmount(wallet.coin)}</strong></span>
            <span>1 coin = {COIN_TO_MONEY_RATE} money</span>
          </div>

          <label className="flex flex-col gap-1" htmlFor="quick-exchange-amount">
            <span className="text-[12px] text-[#555]">교환할 코인 수량</span>
            <input
              id="quick-exchange-amount"
              autoFocus
              type="number"
              min={1}
              step={1}
              value={coinAmount}
              onChange={(event) => setCoinAmount(event.target.value)}
              className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] outline-none focus:border-[#217346]"
            />
          </label>

          <p data-quick-exchange-field="preview" className="text-[12px] text-[#555]">
            교환 후 예상 머니 <strong className="text-[#333]">{formatAmount(previewMoney)}</strong>
            {validCoin && !enoughCoin ? <span className="ml-2 text-[#c0392b]">코인이 부족합니다</span> : null}
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="border border-[#c8c8c8] text-[#555] hover:bg-[#f5f5f5] text-[13px] rounded-sm px-4 py-2">
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !validCoin || !enoughCoin}
              className="bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-60 text-white text-[13px] rounded-sm px-4 py-2"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
