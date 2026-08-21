"use client";

import { useState, type ReactNode } from "react";
import type { WalletProfile } from "@/lib/wallet";

export type ExchangeDirection = "coinToMoney" | "moneyToCoin";

const EXCHANGE_COLUMN_COUNT = 14;
const EXCHANGE_ROW_COUNT = 28;
const EXCHANGE_CELL_CLASS = "border border-[#d9e2f3] bg-white text-center text-[#333]";

function ExchangeCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div data-exchange-cell="true" className={`${EXCHANGE_CELL_CLASS} ${className}`}>
      {children}
    </div>
  );
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function ExchangeSheet({
  wallet,
  onExchange,
}: {
  wallet: WalletProfile;
  onExchange: (direction: ExchangeDirection, amount: number) => void | Promise<void>;
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
        <div className="grid min-h-full grid-cols-[36px_repeat(14,100px)] auto-rows-[26px] text-[13px]">
          <div className="border border-[#d9e2f3] bg-[#f2f2f2]" />
          {Array.from({ length: EXCHANGE_COLUMN_COUNT }, (_, index) => (
            <div key={`exchange-col-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
              {String.fromCharCode(65 + index)}
            </div>
          ))}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
          <ExchangeCell />
          {Array.from({ length: EXCHANGE_COLUMN_COUNT - 1 }, (_, index) => <ExchangeCell key={`row-1-cell-${index + 1}`} />)}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
          <ExchangeCell className="px-1 py-1 font-medium">보유 코인 <strong className="ml-1 font-bold">{formatAmount(wallet.coin)}</strong></ExchangeCell>
          {Array.from({ length: 2 }, (_, index) => <ExchangeCell key={`row-2-cell-${index + 1}`} />)}
          <ExchangeCell className="px-1 py-1 font-medium">보유 머니 <strong className="ml-1 font-bold">{formatAmount(wallet.money)}</strong></ExchangeCell>
          {Array.from({ length: EXCHANGE_COLUMN_COUNT - 4 }, (_, index) => <ExchangeCell key={`row-2-cell-${index + 4}`} />)}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">3</div>
          <ExchangeCell>
            <button type="button" data-exchange-direction="coinToMoney" onClick={() => setDirection("coinToMoney")} className={`h-full w-full text-center font-medium text-[#333] hover:bg-[#f5f5f5] ${direction === "coinToMoney" ? "bg-[#eaf7ee] font-bold underline underline-offset-2" : ""}`}>
              코인 → 머니
            </button>
          </ExchangeCell>
          <ExchangeCell>
            <button type="button" data-exchange-direction="moneyToCoin" onClick={() => setDirection("moneyToCoin")} className={`h-full w-full text-center font-medium text-[#333] hover:bg-[#f5f5f5] ${direction === "moneyToCoin" ? "bg-[#eaf7ee] font-bold underline underline-offset-2" : ""}`}>
              머니 → 코인
            </button>
          </ExchangeCell>
          {Array.from({ length: EXCHANGE_COLUMN_COUNT - 2 }, (_, index) => <ExchangeCell key={`row-3-cell-${index + 3}`} />)}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">4</div>
          <ExchangeCell>1 coin = 100 money</ExchangeCell>
          {Array.from({ length: 3 }, (_, index) => <ExchangeCell key={`row-4-cell-${index + 1}`} />)}
          <ExchangeCell className="flex items-center justify-center gap-1 whitespace-nowrap font-medium">
            <label htmlFor="exchange-amount">수량</label>
          </ExchangeCell>
          <ExchangeCell className="p-0">
            <input id="exchange-amount" aria-label="수량" type="number" min={1} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} className="h-full w-full border-0 px-1.5 text-center font-medium outline-none focus:bg-[#f5f5f5]" />
          </ExchangeCell>
          {Array.from({ length: EXCHANGE_COLUMN_COUNT - 6 }, (_, index) => <ExchangeCell key={`row-4-cell-${index + 6}`} />)}

          <div className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">5</div>
          <ExchangeCell className="font-medium whitespace-nowrap">
            <span data-exchange-field="preview-label">예상 결과</span>
          </ExchangeCell>
          <ExchangeCell className="font-medium whitespace-nowrap">
            <strong data-exchange-field="preview-value" className="whitespace-nowrap font-bold">{validAmount ? formatAmount(preview) : "-"}</strong>
          </ExchangeCell>
          {Array.from({ length: 3 }, (_, index) => <ExchangeCell key={`row-5-cell-${index + 2}`} />)}
          <ExchangeCell>
            <button type="button" disabled={!validAmount} onClick={() => onExchange(direction, numericAmount)} className="h-full w-full text-center font-medium text-[#333] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-[#777] disabled:opacity-100">
              교환하기
            </button>
          </ExchangeCell>
          {Array.from({ length: EXCHANGE_COLUMN_COUNT - 6 }, (_, index) => <ExchangeCell key={`row-5-cell-${index + 6}`} />)}

          {Array.from({ length: EXCHANGE_ROW_COUNT - 5 }, (_, index) => (
            <div key={`empty-row-${index}`} className="contents">
              <div className="border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{index + 6}</div>
              {Array.from({ length: EXCHANGE_COLUMN_COUNT }, (_, cellIndex) => <ExchangeCell key={`empty-cell-${index}-${cellIndex}`} className="border-[#e8edf3]" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
