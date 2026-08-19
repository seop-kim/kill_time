"use client";

import { useState } from "react";

const RIBBON_TABS = ["파일", "홈", "삽입", "페이지 레이아웃", "수식", "데이터", "검토", "보기", "자동화", "도움말", "그리기"];

function Icon({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="#5f6368"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const UndoIcon = () => (
  <Icon>
    <path d="M6 3L3 6l3 3" />
    <path d="M3 6h6a4 4 0 010 8h-2" />
  </Icon>
);
const RedoIcon = () => (
  <Icon>
    <path d="M10 3l3 3-3 3" />
    <path d="M13 6H7a4 4 0 000 8h2" />
  </Icon>
);
const PasteIcon = () => (
  <Icon size={16}>
    <rect x="3" y="3" width="10" height="12" rx="1" />
    <rect x="6" y="1.3" width="4" height="2.4" rx="0.5" />
    <line x1="5" y1="8" x2="11" y2="8" />
    <line x1="5" y1="10.5" x2="11" y2="10.5" />
  </Icon>
);
const ScissorsIcon = () => (
  <Icon size={11}>
    <circle cx="4" cy="4" r="1.6" />
    <circle cx="4" cy="12" r="1.6" />
    <line x1="5.2" y1="5.2" x2="13" y2="13" />
    <line x1="5.2" y1="10.8" x2="13" y2="3" />
  </Icon>
);
const CopyIcon = () => (
  <Icon size={11}>
    <rect x="3" y="2" width="8" height="9" rx="1" />
    <rect x="5" y="5" width="8" height="9" rx="1" />
  </Icon>
);
const PainterIcon = () => (
  <Icon size={11}>
    <rect x="3" y="2" width="7" height="4" rx="0.5" />
    <rect x="5.5" y="6" width="2" height="7" rx="0.5" />
  </Icon>
);
const BucketIcon = () => (
  <Icon size={11}>
    <path d="M3 7l5-5 5 5-5 5-5-5z" />
    <path d="M3 7l5 5" />
  </Icon>
);
const BorderIcon = () => (
  <Icon>
    <rect x="2" y="2" width="12" height="12" />
    <line x1="2" y1="8" x2="14" y2="8" />
    <line x1="8" y1="2" x2="8" y2="14" />
  </Icon>
);
const WrapIcon = () => (
  <Icon>
    <line x1="2" y1="3.5" x2="14" y2="3.5" />
    <line x1="2" y1="8" x2="10" y2="8" />
    <path d="M10 8h2v4h-2" />
    <path d="M8 10.5l-2 1.5 2 1.5" />
    <line x1="2" y1="12.5" x2="6" y2="12.5" />
  </Icon>
);
const OrientationIcon = () => (
  <Icon>
    <path d="M3 13L11 3" />
    <path d="M8 3h3v3" />
  </Icon>
);
const MergeIcon = () => (
  <Icon>
    <line x1="2" y1="4" x2="14" y2="4" />
    <path d="M5 8h6" />
    <path d="M7 6l-2 2 2 2" />
    <path d="M9 6l2 2-2 2" />
    <line x1="2" y1="12" x2="14" y2="12" />
  </Icon>
);
const SumIcon = () => (
  <Icon size={11}>
    <path d="M12 3H4l4 5-4 5h8" />
  </Icon>
);
const EraserIcon = () => (
  <Icon size={11}>
    <rect x="2.5" y="6.5" width="9" height="5" rx="1" transform="rotate(-25 7 9)" />
    <line x1="4.5" y1="12" x2="12.5" y2="12" />
  </Icon>
);
const FunnelIcon = () => (
  <Icon size={11}>
    <path d="M2 3h12l-4.5 6v4l-3 1.5V9z" />
  </Icon>
);
const SearchIconSmall = () => (
  <Icon size={11}>
    <circle cx="6.5" cy="6.5" r="4" />
    <line x1="9.5" y1="9.5" x2="14" y2="14" />
  </Icon>
);
const ShieldIcon = () => (
  <Icon>
    <path d="M8 1.5l5.5 2v4c0 4-2.3 6.8-5.5 8-3.2-1.2-5.5-4-5.5-8v-4l5.5-2z" />
  </Icon>
);
function AddinsIcon() {
  return (
    <div className="grid grid-cols-2 gap-[1px] w-[13px] h-[13px] shrink-0">
      <div className="bg-[#e64a19]" />
      <div className="bg-[#43a047]" />
      <div className="bg-[#1e88e5]" />
      <div className="bg-[#fbc02d]" />
    </div>
  );
}
const CommentIcon = () => (
  <Icon>
    <path d="M2 3h12v7H6l-3 3v-3H2V3z" />
  </Icon>
);
const HistoryIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3l2 2" />
  </Icon>
);
const PencilIcon = () => (
  <Icon size={11}>
    <path d="M11 2l3 3-8 8H3v-3l8-8z" />
  </Icon>
);
const KeyboardIcon = () => (
  <Icon>
    <rect x="2" y="4" width="12" height="8" rx="1" />
    <line x1="4.5" y1="7" x2="4.5" y2="7" />
    <line x1="7" y1="7" x2="9" y2="7" />
    <line x1="11.5" y1="7" x2="11.5" y2="7" />
    <line x1="4.5" y1="9.5" x2="11.5" y2="9.5" />
  </Icon>
);
const ExpandIcon = () => (
  <Icon>
    <path d="M2 5V2h3" />
    <path d="M11 2h3v3" />
    <path d="M14 11v3h-3" />
    <path d="M5 14H2v-3" />
  </Icon>
);
const CloudIcon = () => (
  <Icon size={13}>
    <path d="M5 12a3 3 0 010-6 4 4 0 017.5-1.5A3.5 3.5 0 0113 12H5z" />
  </Icon>
);
const LinkIcon = () => (
  <Icon size={12}>
    <path d="M5 11a2.5 2.5 0 010-3.5l1.5-1.5a2.5 2.5 0 013.5 3.5" />
    <path d="M11 5a2.5 2.5 0 010 3.5L9.5 10A2.5 2.5 0 016 6.5" />
  </Icon>
);
const GearIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#5f6368"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const ChevronLeft = () => (
  <Icon size={11}>
    <path d="M10 3l-5 5 5 5" />
  </Icon>
);
const ChevronRight = () => (
  <Icon size={11}>
    <path d="M6 3l5 5-5 5" />
  </Icon>
);
const HamburgerIcon = () => (
  <Icon size={11}>
    <line x1="2" y1="4" x2="14" y2="4" />
    <line x1="2" y1="8" x2="14" y2="8" />
    <line x1="2" y1="12" x2="14" y2="12" />
  </Icon>
);
const PlusSmall = () => (
  <Icon size={11}>
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </Icon>
);
const UpTriangle = () => (
  <Icon size={7}>
    <path d="M2 9l6-6 6 6" />
  </Icon>
);
const DownTriangle = () => (
  <Icon size={7}>
    <path d="M2 3l6 6 6-6" />
  </Icon>
);
const InsertCellIcon = () => (
  <Icon size={12}>
    <rect x="2" y="2" width="8" height="8" />
    <line x1="2" y1="6" x2="10" y2="6" />
    <line x1="6" y1="2" x2="6" y2="10" />
    <circle cx="12.3" cy="12.3" r="2.7" fill="#1a7f37" stroke="none" />
    <path d="M12.3 11v2.6M11 12.3h2.6" stroke="white" strokeWidth="1" />
  </Icon>
);
const DeleteCellIcon = () => (
  <Icon size={12}>
    <rect x="2" y="2" width="8" height="8" />
    <line x1="2" y1="6" x2="10" y2="6" />
    <line x1="6" y1="2" x2="6" y2="10" />
    <circle cx="12.3" cy="12.3" r="2.7" fill="#c0392b" stroke="none" />
    <path d="M11.2 11.2l2.2 2.2M13.4 11.2l-2.2 2.2" stroke="white" strokeWidth="1" />
  </Icon>
);
const FormatCellIcon = () => (
  <Icon size={12}>
    <rect x="2" y="4" width="8" height="8" />
    <path d="M11 2l3 3-6 6H5v-3z" />
  </Icon>
);
const ConditionalFormatIcon = () => (
  <Icon size={11}>
    <rect x="2" y="2" width="3" height="3" fill="#4caf50" stroke="none" />
    <rect x="6.5" y="2" width="3" height="3" fill="#ffc107" stroke="none" />
    <rect x="11" y="2" width="3" height="3" fill="#f44336" stroke="none" />
    <line x1="2" y1="9" x2="14" y2="9" />
    <line x1="2" y1="12" x2="14" y2="12" />
  </Icon>
);
const TableFormatIcon = () => (
  <Icon size={11}>
    <rect x="2" y="2" width="12" height="10" />
    <line x1="2" y1="5.5" x2="14" y2="5.5" />
    <line x1="6" y1="2" x2="6" y2="12" />
    <line x1="10" y1="2" x2="10" y2="12" />
  </Icon>
);
const CellStyleIcon = () => (
  <Icon size={11}>
    <rect x="2" y="2" width="12" height="10" fill="#e3f2fd" />
    <line x1="2" y1="6" x2="14" y2="6" />
  </Icon>
);

function Waffle() {
  return (
    <div className="grid grid-cols-3 gap-[1.5px] w-[13px] h-[13px] shrink-0">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="bg-[#5f6368] rounded-[0.5px]" />
      ))}
    </div>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <span className="text-[9px] text-[#777] whitespace-nowrap">{children}</span>;
}

function Divider() {
  return <div className="w-px self-stretch bg-[#e4e4e4] mx-1.5 my-1" />;
}

function Chevron() {
  return <span className="text-[7px] text-[#777] ml-[1px]">▾</span>;
}

function VAlign({ pos, selected }: { pos: "start" | "center" | "end"; selected?: boolean }) {
  return (
    <div
      className={`w-[14px] h-[14px] border flex flex-col p-[2px] shrink-0 ${
        selected ? "border-[#217346] bg-[#e6f2ea]" : "border-[#8a8a8a]"
      }`}
      style={{ justifyContent: pos === "start" ? "flex-start" : pos === "center" ? "center" : "flex-end" }}
    >
      <div className="bg-[#6b6b6b]" style={{ height: 1.5, width: "100%" }} />
    </div>
  );
}

function HAlign({ pos, selected }: { pos: "start" | "center" | "end"; selected?: boolean }) {
  const align = pos === "start" ? "flex-start" : pos === "center" ? "center" : "flex-end";
  return (
    <div
      className={`w-[14px] h-[14px] flex flex-col justify-center gap-[2px] shrink-0 rounded-[1px] ${
        selected ? "bg-[#e6f2ea]" : ""
      }`}
      style={{ alignItems: align }}
    >
      <div className="bg-[#6b6b6b] h-[1.5px] w-full" />
      <div className="bg-[#6b6b6b] h-[1.5px]" style={{ width: "65%" }} />
      <div className="bg-[#6b6b6b] h-[1.5px]" style={{ width: "90%" }} />
    </div>
  );
}

function MiniBtn({ children, w }: { children: React.ReactNode; w?: number }) {
  return (
    <div
      className="flex items-center justify-center gap-[1px] text-[10px] text-[#555] hover:bg-[#e8e8e8] rounded-[2px] h-[18px] shrink-0"
      style={{ minWidth: w ?? 18 }}
    >
      {children}
    </div>
  );
}

function StackBtn({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-[#444] hover:bg-[#e8e8e8] rounded-[2px] px-1 h-[16px] whitespace-nowrap">
      {icon ?? <div className="w-[10px] h-[10px] border border-[#9a9a9a] shrink-0" />}
      <span>{label}</span>
      <Chevron />
    </div>
  );
}

function Dropdown({ children, w = 70 }: { children: React.ReactNode; w?: number }) {
  return (
    <div
      className="bg-white border border-[#c8c8c8] rounded-[2px] text-[10px] text-[#444] px-1.5 h-[19px] flex items-center justify-between gap-1"
      style={{ width: w }}
    >
      <span className="truncate">{children}</span>
      <Chevron />
    </div>
  );
}

function TopBtn({ icon, label, pill }: { icon: React.ReactNode; label: string; pill?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-1 text-[10px] ${
        pill ? "border border-[#d8d8d8] rounded-full" : "hover:bg-[#f0f0f0] rounded-[2px]"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

export interface ChromeAvatar {
  name: string;
  color: string;
  isTurn: boolean;
  online?: boolean;
}

export interface GameTab {
  id: string;
  label: string;
  available: boolean;
}

const zoomStyle = { zoom: 1.5 } as React.CSSProperties;

export function ExcelChrome({
  fileName,
  avatars,
  onShare,
  games,
  activeGameId,
  onSelectGame,
  rematchLabel,
  onRematch,
  onRestart,
  onLeave,
  timerSeconds,
  onOpenChat,
  onRequestUndo,
  onRequestDraw,
  children,
}: {
  fileName: string;
  avatars: ChromeAvatar[];
  onShare: () => void;
  games: GameTab[];
  activeGameId: string;
  onSelectGame: (id: string) => void;
  rematchLabel?: string;
  onRematch?: () => void;
  onRestart?: () => void;
  onLeave?: () => void;
  timerSeconds?: number | null;
  onOpenChat?: () => void;
  onRequestUndo?: () => void;
  onRequestDraw?: () => void;
  children: React.ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addinsOpen, setAddinsOpen] = useState(false);
  const [avatarTooltip, setAvatarTooltip] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#333]" style={zoomStyle}>
      <div className="shrink-0">
        {/* row 1: title bar */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#e8e8e8]">
          <Waffle />
          <svg width="18" height="18" viewBox="0 0 32 32" className="shrink-0">
            <rect width="32" height="32" rx="4" fill="#217346" />
            <rect x="6" y="6" width="20" height="20" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.4" />
            <line x1="6" y1="13" x2="26" y2="13" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" />
            <line x1="6" y1="19.5" x2="26" y2="19.5" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" />
            <line x1="13" y1="6" x2="13" y2="26" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" />
            <line x1="19.5" y1="6" x2="19.5" y2="26" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" />
          </svg>
          <span className="text-[13px] text-[#444]">{fileName}</span>
          <span className="w-[13px] h-[13px] rounded-full border border-[#aaa] text-[8px] text-[#888] flex items-center justify-center">
            ?
          </span>
          <CloudIcon />

          <div className="flex-1 flex justify-center">
            <div className="w-[340px] max-w-full bg-[#f3f2f1] rounded-full px-3 py-1 flex items-center gap-1.5 select-none">
              <SearchIconSmall />
              <span className="text-[11px] text-[#888]">도구, 도움말 등을 검색(Alt + Q)</span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="flex items-center justify-center hover:bg-[#f0f0f0] rounded-[2px] p-[2px]"
            >
              <GearIcon />
            </button>
            {settingsOpen && (onRestart || onLeave) && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 top-[26px] z-50 bg-white border border-[#d0d0d0] rounded-sm shadow-md py-1 w-[140px] text-[11px] text-[#333]">
                  {onRestart && (
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        onRestart();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0]"
                    >
                      게임 다시 시작
                    </button>
                  )}
                  {onLeave && (
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        onLeave();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0]"
                    >
                      방 나가기
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {avatars[0] && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] leading-none font-bold text-white shrink-0"
              style={{ background: avatars[0].color }}
            >
              <span className="translate-y-[0.5px]">{avatars[0].name.slice(0, 1)}</span>
            </div>
          )}
        </div>

        {/* row 2: ribbon tabs + collaboration cluster */}
        <div className="flex items-center justify-between px-3 border-b border-[#d0d0d0]">
          <div className="flex gap-4 text-[11px] text-[#444] pt-1.5">
            {RIBBON_TABS.map((tab) => (
              <span
                key={tab}
                className={tab === "홈" ? "text-[#185abd] font-semibold border-b-2 border-[#185abd] pb-1.5" : "pb-1.5"}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-[#555]">
            {typeof timerSeconds === "number" && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm mr-1 tabular-nums ${
                  timerSeconds <= 10 ? "text-[#c0392b] bg-[#fdecea]" : "text-[#555] bg-[#f0f0f0]"
                }`}
              >
                {timerSeconds}s
              </span>
            )}
            <div
              className="relative flex items-center -space-x-1.5 mr-1"
              onMouseEnter={() => setAvatarTooltip(true)}
              onMouseLeave={() => setAvatarTooltip(false)}
            >
              {avatars.map((a) => (
                <div
                  key={a.name}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] leading-none font-bold text-white ring-2 ring-white"
                  style={{ background: a.color, boxShadow: a.isTurn ? "0 0 0 2px #e4693f" : undefined }}
                >
                  <span className="translate-y-[0.5px]">{a.name.slice(0, 1)}</span>
                </div>
              ))}
              {avatarTooltip && (
                <div className="absolute right-0 top-[22px] z-50 bg-white border border-[#d0d0d0] rounded-sm shadow-md py-1.5 px-2 w-[150px] text-[10px] text-[#333]">
                  <div className="text-[9px] text-[#999] px-1 pb-1">현재 참여자</div>
                  {avatars.map((a) => (
                    <div key={a.name} className="flex items-center gap-1.5 px-1 py-0.5">
                      <span
                        className="w-[7px] h-[7px] rounded-full shrink-0"
                        style={{ background: a.online === false ? "#bbb" : "#3aa757" }}
                      />
                      <span className="truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <TopBtn icon={<CommentIcon />} label="메모" />
            <TopBtn icon={<HistoryIcon />} label="따라잡기" />
            <TopBtn icon={<PencilIcon />} label="편집 중" pill />
            <TopBtn icon={<ShieldIcon />} label="민감도" />
            <Chevron />
            <button
              onClick={onShare}
              className="bg-[#217346] hover:bg-[#1a5c38] text-white text-[11px] rounded-sm px-2.5 py-1 flex items-center gap-1 ml-1 shrink-0"
            >
              공유 <span className="text-[8px]">▾</span>
            </button>
          </div>
        </div>

        {/* row 3: ribbon toolbar */}
        <div className="flex items-stretch px-2 py-1 border-b border-[#d0d0d0] bg-gradient-to-b from-white to-[#f3f2f1] overflow-x-auto">
          <div className="flex flex-col items-center gap-1 pr-1.5">
            <div className="flex items-center gap-1">
              <MiniBtn>
                <UndoIcon />
              </MiniBtn>
              <MiniBtn>
                <RedoIcon />
              </MiniBtn>
            </div>
            <GroupLabel>실행 취소</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <MiniBtn w={30}>
                <PasteIcon />
                <Chevron />
              </MiniBtn>
              <div className="flex flex-col gap-[2px]">
                <span className="flex items-center gap-1 text-[9px] text-[#555] leading-none">
                  <ScissorsIcon /> 잘라내기
                </span>
                <span className="flex items-center gap-1 text-[9px] text-[#555] leading-none">
                  <CopyIcon /> 복사 <Chevron />
                </span>
                <span className="flex items-center gap-1 text-[9px] text-[#555] leading-none">
                  <PainterIcon /> 서식 복사
                </span>
              </div>
            </div>
            <GroupLabel>클립보드</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <Dropdown w={80}>游ゴシック</Dropdown>
              <Dropdown w={32}>10</Dropdown>
              <MiniBtn>
                가<UpTriangle />
              </MiniBtn>
              <MiniBtn>
                가<DownTriangle />
              </MiniBtn>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#555]">가</span>
              <span className="text-[10px] italic text-[#555]">가</span>
              <span className="text-[10px] underline text-[#555]">가</span>
              <Chevron />
              <span className="text-[10px] line-through text-[#555]">가</span>
              <span className="text-[9px] text-[#555]">
                가<sub className="text-[6px]">2</sub>/가<sup className="text-[6px]">2</sup>
              </span>
              <MiniBtn>
                <BucketIcon />
                <div className="w-[8px] h-[2px] bg-[#f2b705]" />
                <Chevron />
              </MiniBtn>
              <MiniBtn>
                <span>가</span>
                <div className="w-[8px] h-[2px] bg-[#c00]" />
                <Chevron />
              </MiniBtn>
              <MiniBtn>
                <BorderIcon />
                <Chevron />
              </MiniBtn>
            </div>
            <GroupLabel>글꼴</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <VAlign pos="start" />
                  <VAlign pos="center" />
                  <VAlign pos="end" selected />
                  <div className="w-px h-[14px] bg-[#e4e4e4] mx-0.5" />
                  <MiniBtn>
                    <OrientationIcon />
                  </MiniBtn>
                </div>
                <div className="flex items-center gap-1">
                  <HAlign pos="start" />
                  <HAlign pos="center" selected />
                  <HAlign pos="end" />
                </div>
              </div>
              <div className="w-px self-stretch bg-[#e4e4e4]" />
              <div className="flex flex-col gap-[3px] justify-center">
                <StackBtn label="텍스트 줄바꿈" icon={<WrapIcon />} />
                <StackBtn label="병합하고 가운데 맞춤" icon={<MergeIcon />} />
              </div>
            </div>
            <div className="text-center">
              <GroupLabel>맞춤</GroupLabel>
            </div>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-1">
            <Dropdown w={76}>날짜</Dropdown>
            <div className="flex items-center gap-1.5 text-[10px] text-[#555]">
              <span>$€</span>
              <span>%</span>
              <span>,</span>
              <MiniBtn w={14}>
                0<DownTriangle />
              </MiniBtn>
              <MiniBtn w={14}>
                0<UpTriangle />
              </MiniBtn>
            </div>
            <GroupLabel>숫자</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-[3px] justify-center">
            <StackBtn label="조건부 서식" icon={<ConditionalFormatIcon />} />
            <StackBtn label="테이블로 서식 지정" icon={<TableFormatIcon />} />
            <StackBtn label="셀 스타일" icon={<CellStyleIcon />} />
            <GroupLabel>스타일</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-[3px] justify-center">
            <StackBtn label="삽입" icon={<InsertCellIcon />} />
            <StackBtn label="삭제" icon={<DeleteCellIcon />} />
            <StackBtn label="서식" icon={<FormatCellIcon />} />
            <GroupLabel>셀</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-[3px]">
                <StackBtn label="자동 합계" icon={<SumIcon />} />
                <StackBtn label="지우기" icon={<EraserIcon />} />
              </div>
              <div className="flex flex-col gap-[3px]">
                <StackBtn label="정렬 및 필터" icon={<FunnelIcon />} />
                <StackBtn label="찾기 및 선택" icon={<SearchIconSmall />} />
              </div>
            </div>
            <GroupLabel>편집</GroupLabel>
          </div>
          <Divider />

          <div className="flex flex-col items-center justify-center gap-0.5 text-[9px] text-[#555] px-1">
            <ShieldIcon />
            <span className="flex items-center">
              민감도
              <Chevron />
            </span>
          </div>
          <div className="relative flex flex-col items-center justify-center gap-0.5 text-[9px] text-[#555] px-1">
            <button
              onClick={() => setAddinsOpen((v) => !v)}
              className="flex flex-col items-center gap-0.5 hover:bg-[#e8e8e8] rounded-[2px] px-1"
            >
              <AddinsIcon />
              추가 기능
            </button>
            {addinsOpen && (onOpenChat || onRequestUndo || onRequestDraw) && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddinsOpen(false)} />
                <div className="absolute right-0 top-[30px] z-50 bg-white border border-[#d0d0d0] rounded-sm shadow-md py-1 w-[130px] text-[11px] text-[#333] text-left">
                  {onOpenChat && (
                    <button
                      onClick={() => {
                        setAddinsOpen(false);
                        onOpenChat();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0]"
                    >
                      채팅
                    </button>
                  )}
                  {onRequestUndo && (
                    <button
                      onClick={() => {
                        setAddinsOpen(false);
                        onRequestUndo();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0]"
                    >
                      한 수 무르기
                    </button>
                  )}
                  {onRequestDraw && (
                    <button
                      onClick={() => {
                        setAddinsOpen(false);
                        onRequestDraw();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0]"
                    >
                      무승부 요청
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {children}

      <div className="shrink-0">
        {/* sheet tab bar, repurposed as the game list */}
        <div className="flex items-center gap-2 px-2 py-1 border-t border-[#d0d0d0] bg-white text-[11px]">
          <ChevronLeft />
          <ChevronRight />
          <HamburgerIcon />
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelectGame(g.id)}
              className={
                g.id === activeGameId
                  ? "bg-[#e8f0fe] text-[#217346] font-semibold border-t-2 border-[#217346] px-3 py-1 rounded-t-sm"
                  : g.available
                    ? "text-[#666] px-2 py-1 hover:bg-[#f0f0f0] rounded-t-sm"
                    : "text-[#bbb] px-2 py-1"
              }
            >
              {g.label}
            </button>
          ))}
          <span className="px-1">
            <PlusSmall />
          </span>
          {onRematch && (
            <button
              onClick={onRematch}
              className="ml-auto text-[11px] bg-[#217346] hover:bg-[#1a5c38] text-white rounded-sm px-3 py-1"
            >
              {rematchLabel}
            </button>
          )}
        </div>

        {/* status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#f3f2f1] border-t border-[#e0e0e0] text-[10px] text-[#666]">
          <span>통합 문서 통계</span>
          <div className="flex items-center gap-2.5">
            <Chevron />
            <KeyboardIcon />
            <span className="w-[13px] h-[13px] rounded-full border border-[#999] text-[8px] flex items-center justify-center">
              ?
            </span>
            <LinkIcon />
            <span>–</span>
            <span>100%</span>
            <span>+</span>
            <ExpandIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
