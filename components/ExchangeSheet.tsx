"use client";

import { useState } from "react";
import type { WalletProfile } from "@/lib/wallet";

export type ExchangeDirection = "coinToMoney" | "moneyToCoin";

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function ExchangeSheet({
  wallet,
  onExchange,
  onBack,
}: {
  wallet: WalletProfile;
  onExchange: (direction: ExchangeDirection, amount: number) => void | Promise<void>;
  onBack: () => void;
}) {
  const [direction, setDirection] = useState<ExchangeDirection>("coinToMoney");
  const [amount, setAmount] = useState("");
  const numericAmount = Number(amount);
  const validAmount = Number.isInteger(numericAmount) && numericAmount > 0;
  const preview = validAmount
    ? direction === "coinToMoney"
      ? numericAmount * 100
      : numericAmount / 100
    : 0;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
      <div className="absolute inset-0 overflow-auto">
        <div className="grid min-h-full grid-cols-[40px_repeat(10,120px)] auto-rows-[30px] text-[11px]">
          <div className="border border-[#d9e2f3] bg-[#f2f2f2]" />
          {Array.from({ length: 10 }, (_, index) => (
            <div key={`exchange-col-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
              {String.fromCharCode(65 + index)}
            </div>
          ))}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
          <div className="col-span-5 border border-[#b7c9e2] bg-[#eaf2f8] px-3 py-1 font-semibold text-[#1f4e79]">머니 교환</div>
          <div className="col-span-5 border border-[#d9e2f3] bg-white" />

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
          <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-3 py-1">보유 코인 <strong>{formatAmount(wallet.coin)}</strong></div>
          <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-3 py-1">보유 머니 <strong>{formatAmount(wallet.money)}</strong></div>
          <div className="col-span-4 border border-[#d9e2f3] bg-white" />

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">3</div>
          <button type="button" onClick={() => setDirection("coinToMoney")} className={`col-span-3 border px-3 text-left ${direction === "coinToMoney" ? "border-[#217346] bg-[#eaf7ee] font-semibold text-[#217346]" : "border-[#d9e2f3] bg-white text-[#555]"}`}>
            코인 → 머니
          </button>
          <button type="button" onClick={() => setDirection("moneyToCoin")} className={`col-span-3 border px-3 text-left ${direction === "moneyToCoin" ? "border-[#217346] bg-[#eaf7ee] font-semibold text-[#217346]" : "border-[#d9e2f3] bg-white text-[#555]"}`}>
            머니 → 코인
          </button>
          <div className="col-span-4 border border-[#d9e2f3] bg-white" />

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">4</div>
          <div className="col-span-4 border border-[#d9e2f3] px-3 py-1">1 coin = 100 money</div>
          <label className="col-span-3 flex items-center gap-2 border border-[#d9e2f3] px-3">
            수량
            <input type="number" min={1} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-[100px] border border-[#c8c8c8] px-1.5 py-1 text-right outline-none focus:border-[#217346]" />
          </label>
          <div className="col-span-3 border border-[#d9e2f3] bg-white" />

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">5</div>
          <div className="col-span-4 border border-[#d9e2f3] bg-[#f8f8f8] px-3 py-1">예상 결과 <strong>{validAmount ? formatAmount(preview) : "-"}</strong></div>
          <button type="button" disabled={!validAmount} onClick={() => onExchange(direction, numericAmount)} className="col-span-3 border border-[#8bb8a0] bg-[#217346] px-3 text-white disabled:cursor-not-allowed disabled:opacity-40">
            교환하기
          </button>
          <button type="button" onClick={onBack} className="col-span-3 border border-[#d9e2f3] bg-white text-[#555] hover:bg-[#f5f5f5]">허브로 돌아가기</button>
        </div>
      </div>
    </div>
  );
}
