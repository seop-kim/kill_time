function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function SeotdaGamePanel({ moneyStake }: { moneyStake: number }) {
  return (
    <div className="h-full overflow-auto bg-white">
      <div className="grid min-h-full grid-cols-[40px_repeat(12,110px)] auto-rows-[28px] text-[11px]">
        <div className="sticky left-0 top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2]" />
        {Array.from({ length: 12 }, (_, index) => (
          <div key={`column-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
            {String.fromCharCode(65 + index)}
          </div>
        ))}

        <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
        <div className="col-span-3 border border-[#b7c9e2] bg-[#eaf2f8] px-2 py-1 font-semibold text-[#1f4e79]">섯다</div>
        <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-2 py-1 text-[#7f6000]">판돈</div>
        <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-2 py-1 font-semibold text-[#333]">{formatAmount(moneyStake)} money</div>
        <div className="col-span-3 border border-[#d9e2f3] bg-white" />

        <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
        <div className="col-span-12 border border-[#d9e2f3] bg-white px-2 py-1 text-[#777]">게임 화면 준비 중</div>

        {Array.from({ length: 8 }, (_, row) => (
          <div key={`row-${row}`} className="contents">
            <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{row + 3}</div>
            {Array.from({ length: 12 }, (_, column) => (
              <div key={`cell-${row}-${column}`} className="border border-[#e8edf3] bg-white" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
