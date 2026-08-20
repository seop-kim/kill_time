import { ExcelChrome, type ChromeAvatar, type GameTab } from "./ExcelChrome";
import type { WalletProfile } from "@/lib/wallet";

const WORKSPACE_TABS: GameTab[] = [{ id: "workspace", label: "홈", available: true }];

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function WorkspaceHome({
  nickname,
  wallet,
  attendanceClaimed,
  attendanceBusy = false,
  onCreateDocument,
  onOpenJoin,
  onOpenExchange,
  onClaimAttendance,
}: {
  nickname: string;
  wallet: WalletProfile;
  attendanceClaimed: boolean;
  attendanceBusy?: boolean;
  onCreateDocument: () => void;
  onOpenJoin: () => void;
  onOpenExchange: () => void;
  onClaimAttendance: () => void;
}) {
  const avatar: ChromeAvatar = {
    id: "workspace-user",
    name: nickname,
    color: "#217346",
    isTurn: false,
    online: true,
  };

  return (
    <ExcelChrome
      fileName="문서 허브"
      avatars={[avatar]}
      profileAvatar={avatar}
      onShare={() => {}}
      games={WORKSPACE_TABS}
      activeGameId="workspace"
      onSelectGame={() => {}}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
        <div className="absolute inset-0 overflow-auto bg-[#fff]">
          <div className="grid min-h-full grid-cols-[40px_repeat(12,110px)] auto-rows-[28px] text-[11px]">
            <div className="sticky left-0 top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2]" />
            {Array.from({ length: 12 }, (_, index) => (
              <div key={`column-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
                {String.fromCharCode(65 + index)}
              </div>
            ))}
            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
            <div className="col-span-4 border border-[#b7c9e2] bg-[#eaf2f8] px-2 py-1 font-semibold text-[#1f4e79]">
              {nickname}님의 작업 공간
            </div>
            <div className="col-span-8 border border-[#d9e2f3] bg-white" />

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
            <button type="button" onClick={onCreateDocument} className="col-span-3 border border-[#8bb8a0] bg-[#eaf7ee] px-3 text-left font-semibold text-[#217346] hover:bg-[#d9f0e1]">
              문서 만들기
            </button>
            <button type="button" onClick={onOpenJoin} className="col-span-3 border border-[#b7c9e2] bg-[#edf4fb] px-3 text-left font-semibold text-[#1f4e79] hover:bg-[#e1edf8]">
              문서 입장하기
            </button>
            <div className="col-span-6 border border-[#d9e2f3] bg-white" />

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">3</div>
            <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-3 py-1 text-[#7f6000]">
              코인
              <strong className="ml-2 text-[#333]">{formatAmount(wallet.coin)}</strong>
            </div>
            <div className="col-span-3 border border-[#d9e2f3] bg-[#fffdf2] px-3 py-1 text-[#7f6000]">
              머니
              <strong className="ml-2 text-[#333]">{formatAmount(wallet.money)}</strong>
            </div>
            <button type="button" onClick={onOpenExchange} className="col-span-3 border border-[#d9e2f3] bg-white px-3 text-left text-[#555] hover:bg-[#f5f5f5]">
              머니 교환
            </button>
            <div className="col-span-3 border border-[#d9e2f3] bg-white" />

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">4</div>
            <button type="button" disabled={attendanceClaimed || attendanceBusy} onClick={onClaimAttendance} className={`col-span-3 border border-[#d9e2f3] px-3 text-left ${attendanceClaimed || attendanceBusy ? "bg-[#f2f2f2] text-[#999]" : "bg-[#fff2cc] text-[#7f6000] hover:bg-[#ffe699]"}`}>
              {attendanceClaimed ? "출석 완료" : attendanceBusy ? "출석 처리 중..." : "출석체크 +500 coin"}
            </button>
            <div className="col-span-9 border border-[#d9e2f3] bg-white" />

            {Array.from({ length: 8 }, (_, index) => (
              <div key={`empty-row-${index}`} className="contents">
                <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{index + 5}</div>
                {Array.from({ length: 12 }, (_, cellIndex) => (
                  <div key={`empty-cell-${index}-${cellIndex}`} className="border border-[#e8edf3] bg-white" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ExcelChrome>
  );
}
