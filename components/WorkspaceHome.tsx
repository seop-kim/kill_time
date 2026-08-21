import type { ReactNode } from "react";
import { WorkspaceChrome } from "./WorkspaceChrome";
import type { WalletProfile } from "@/lib/wallet";
import type { GameStats } from "@/lib/stats";

const WORKSPACE_COLUMN_COUNT = 14;
const WORKSPACE_ROW_COUNT = 28;
const WORKSPACE_CELL_CLASS = "border border-[#d9e2f3] bg-white text-center";

function WorkspaceCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div data-workspace-cell="true" className={`${WORKSPACE_CELL_CLASS} ${className}`}>
      {children}
    </div>
  );
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function WorkspaceHome({
  nickname,
  wallet,
  onCreateDocument,
  onOpenJoin,
  onOpenExchange,
  profileStats,
}: {
  nickname: string;
  wallet: WalletProfile;
  onCreateDocument: () => void;
  onOpenJoin: () => void;
  onOpenExchange: () => void;
  profileStats?: Record<string, GameStats>;
}) {
  return (
    <WorkspaceChrome nickname={nickname} onNavigateExchange={onOpenExchange} profileStats={profileStats}>
      <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
        <div className="absolute inset-0 overflow-auto bg-[#fff]">
          <div className="grid min-h-full grid-cols-[36px_repeat(14,100px)] auto-rows-[26px] text-[11px]">
            <div className="sticky left-0 top-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2]" />
            {Array.from({ length: WORKSPACE_COLUMN_COUNT }, (_, index) => (
              <div key={`column-${index}`} className="border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">
                {String.fromCharCode(65 + index)}
              </div>
            ))}
            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">1</div>
            <WorkspaceCell />
            {Array.from({ length: WORKSPACE_COLUMN_COUNT - 1 }, (_, index) => <WorkspaceCell key={`row-1-cell-${index + 1}`} />)}

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">2</div>
            <WorkspaceCell>
              <button type="button" onClick={onCreateDocument} className="h-full w-full text-center font-semibold text-[#333] hover:bg-[#f5f5f5]">
                문서 만들기
              </button>
            </WorkspaceCell>
            {Array.from({ length: 2 }, (_, index) => <WorkspaceCell key={`row-2-cell-${index + 1}`} />)}
            <WorkspaceCell>
              <button type="button" onClick={onOpenJoin} className="h-full w-full text-center font-semibold text-[#333] hover:bg-[#f5f5f5]">
                문서 입장하기
              </button>
            </WorkspaceCell>
            {Array.from({ length: WORKSPACE_COLUMN_COUNT - 4 }, (_, index) => <WorkspaceCell key={`row-2-cell-${index + 4}`} />)}

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">3</div>
            <WorkspaceCell className="px-2 py-1 text-[#555]">
              코인
              <strong className="ml-2 text-[#333]">{formatAmount(wallet.coin)}</strong>
            </WorkspaceCell>
            {Array.from({ length: 2 }, (_, index) => <WorkspaceCell key={`row-3-cell-${index + 1}`} />)}
            <WorkspaceCell className="px-2 py-1 text-[#555]">
              머니
              <strong className="ml-2 text-[#333]">{formatAmount(wallet.money)}</strong>
            </WorkspaceCell>
            {Array.from({ length: 2 }, (_, index) => <WorkspaceCell key={`row-3-cell-${index + 4}`} />)}
            <WorkspaceCell />
            {Array.from({ length: WORKSPACE_COLUMN_COUNT - 7 }, (_, index) => <WorkspaceCell key={`row-3-cell-${index + 7}`} />)}

            <div className="sticky left-0 z-10 border border-[#d9e2f3] bg-[#f2f2f2] text-center text-[#49637a]">4</div>
            {Array.from({ length: WORKSPACE_COLUMN_COUNT }, (_, index) => <WorkspaceCell key={`row-4-cell-${index}`} />)}

            {Array.from({ length: WORKSPACE_ROW_COUNT - 4 }, (_, index) => (
              <div key={`empty-row-${index}`} className="contents">
                <div className="sticky left-0 z-10 border border-[#e8edf3] bg-[#f8f8f8] text-center text-[#789]">{index + 5}</div>
                {Array.from({ length: WORKSPACE_COLUMN_COUNT }, (_, cellIndex) => (
                  <WorkspaceCell key={`empty-cell-${index}-${cellIndex}`} className="border-[#e8edf3]" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceChrome>
  );
}
