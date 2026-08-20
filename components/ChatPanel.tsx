"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ParticipantRole } from "@/lib/rooms";

function CIcon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="#616161"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const PopOutIcon = () => (
  <CIcon size={13}>
    <path d="M6 3H3v10h10v-3" />
    <path d="M9 3h4v4" />
    <path d="M13 3L7 9" />
  </CIcon>
);
const HistoryIcon = () => (
  <CIcon>
    <line x1="2" y1="4" x2="14" y2="4" />
    <line x1="2" y1="8" x2="14" y2="8" />
    <line x1="2" y1="12" x2="9" y2="12" />
  </CIcon>
);
const NewChatIcon = () => (
  <CIcon size={13}>
    <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke="white" />
    <path d="M11 8l3-3v3z" fill="white" stroke="none" />
    <path d="M5 9l3-3.5" stroke="white" />
  </CIcon>
);
const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" className="shrink-0">
    <circle cx="3" cy="8" r="1.3" fill="#616161" />
    <circle cx="8" cy="8" r="1.3" fill="#616161" />
    <circle cx="13" cy="8" r="1.3" fill="#616161" />
  </svg>
);

export const MIN_CHAT_TEXT_SIZE = 1;
export const MAX_CHAT_TEXT_SIZE = 24;
export const DEFAULT_CHAT_TEXT_SIZE = 8;
export const MIN_CHAT_WIDTH = 260;
export const MAX_CHAT_WIDTH = 480;
export const DEFAULT_CHAT_WIDTH = 320;

export interface ChatUserColor {
  accent: string;
  surface: string;
}

const CHAT_USER_COLORS: ChatUserColor[] = [
  { accent: "#7b3fe4", surface: "#f1ebff" },
  { accent: "#0f6cbd", surface: "#e9f2fc" },
  { accent: "#e4693f", surface: "#fff0eb" },
  { accent: "#1b8a3d", surface: "#eaf7ee" },
  { accent: "#b05a00", surface: "#fff4e5" },
  { accent: "#c23b8b", surface: "#fceaf5" },
  { accent: "#007c91", surface: "#e5f6f8" },
  { accent: "#8a5a00", surface: "#fff6df" },
  { accent: "#5b4bc4", surface: "#eeecff" },
  { accent: "#b42318", surface: "#ffebe9" },
  { accent: "#37623f", surface: "#eaf4ec" },
  { accent: "#9c2c77", surface: "#fcebf6" },
  { accent: "#006d77", surface: "#e3f5f6" },
  { accent: "#7a4e00", surface: "#fff3d6" },
  { accent: "#42526e", surface: "#edf1f7" },
];

export function getChatUserKey(message: Pick<ChatMessage, "by" | "name" | "participantId">): string {
  return message.participantId ?? `${message.by}:${message.name}`;
}

export function getChatUserColor(participantIndex: number): ChatUserColor {
  const paletteIndex = ((participantIndex % CHAT_USER_COLORS.length) + CHAT_USER_COLORS.length) % CHAT_USER_COLORS.length;
  return CHAT_USER_COLORS[paletteIndex];
}

export function getChatUserColorMap(messages: ChatMessage[]): Map<string, ChatUserColor> {
  const colors = new Map<string, ChatUserColor>();
  for (const message of messages) {
    const key = getChatUserKey(message);
    if (!colors.has(key)) {
      colors.set(key, getChatUserColor(colors.size));
    }
  }
  return colors;
}

export function normalizeChatTextSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CHAT_TEXT_SIZE;
  return Math.min(MAX_CHAT_TEXT_SIZE, Math.max(MIN_CHAT_TEXT_SIZE, Math.round(value)));
}

export function normalizeChatWidth(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CHAT_WIDTH;
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, Math.round(value)));
}

export function TextSizeMenu({
  value,
  onChange,
  onClose,
}: {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  function commitValue() {
    const nextValue = normalizeChatTextSize(Number(draftValue));
    setDraftValue(String(nextValue));
    onChange(nextValue);
  }

  return (
    <div
      role="menu"
      aria-label="텍스트 크기"
      className="absolute right-0 top-[24px] z-30 w-[170px] rounded-sm border border-[#d0d0d0] bg-white py-1.5 text-[12px] text-[#333] shadow-md"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-[#777]">텍스트 크기</div>
      <div className="flex items-center gap-1 px-3 py-1.5">
        <input
          aria-label="채팅 텍스트 크기"
          type="number"
          value={draftValue}
          min={MIN_CHAT_TEXT_SIZE}
          max={MAX_CHAT_TEXT_SIZE}
          step="1"
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitValue();
              onClose();
            }
          }}
          className="w-[58px] rounded-sm border border-[#c8c8c8] px-1.5 py-1 text-right text-[12px] outline-none focus:border-[#217346]"
        />
        <span className="text-[#555]">px</span>
      </div>
      <div className="px-3 text-[10px] text-[#999]">{MIN_CHAT_TEXT_SIZE}~{MAX_CHAT_TEXT_SIZE}px</div>
      <div className="flex justify-end px-3 pt-2">
        <button
          type="button"
          onClick={() => {
            commitValue();
            onClose();
          }}
          className="rounded-sm bg-[#217346] px-2 py-1 text-[11px] text-white hover:bg-[#1a5c38]"
        >
          적용
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({
  open,
  onClose,
  messages,
  myRole,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  myRole: ParticipantRole;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [textSize, setTextSize] = useState(DEFAULT_CHAT_TEXT_SIZE);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const userColors = getChatUserColorMap(messages);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages]);

  if (!open) return null;

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStartRef.current = { pointerX: event.clientX, width: chatWidth };
    setIsResizing(true);
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizeStartRef.current) return;
    const delta = resizeStartRef.current.pointerX - event.clientX;
    setChatWidth(normalizeChatWidth(resizeStartRef.current.width + delta));
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeStartRef.current = null;
    setIsResizing(false);
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? 10 : -10;
    setChatWidth((currentWidth) => normalizeChatWidth(currentWidth + delta));
  }

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[320px] shadow-2xl z-[90] flex flex-col bg-[#fbfbfd] font-sheet ${
        isResizing ? "select-none" : ""
      }`}
      style={{ width: `${chatWidth}px` }}
    >
      <div
        role="separator"
        aria-label="채팅창 너비 조절"
        aria-orientation="vertical"
        aria-valuemin={MIN_CHAT_WIDTH}
        aria-valuemax={MAX_CHAT_WIDTH}
        aria-valuenow={chatWidth}
        tabIndex={0}
        title="드래그하여 채팅창 너비 조절"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
        className="absolute left-0 top-0 bottom-0 z-[95] w-[6px] cursor-ew-resize hover:bg-[#217346]/20"
      />
      {/* title bar */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[14px] font-semibold text-[#1b1b1b]">Copilot</span>
        <div className="flex items-center gap-2.5">
          <PopOutIcon />
          <button onClick={onClose} className="text-[#616161] hover:text-[#1b1b1b] leading-none">
            <svg width="13" height="13" viewBox="0 0 16 16">
              <line x1="3" y1="3" x2="13" y2="13" stroke="#616161" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="13" y1="3" x2="3" y2="13" stroke="#616161" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex items-center justify-between px-3 pb-2 border-b border-[#e8e8ec]">
        <div className="flex items-center gap-2">
          <HistoryIcon />
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M8 1.5l5.5 2v4c0 4-2.3 6.8-5.5 8-3.2-1.2-5.5-4-5.5-8v-4l5.5-2z" fill="none" stroke="#1b8a3d" strokeWidth="1.3" />
            <path d="M5.5 8l1.8 1.8L10.5 6" stroke="#1b8a3d" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0f6cbd] rounded-[4px] overflow-hidden">
            <span className="p-1.5">
              <NewChatIcon />
            </span>
            <span className="w-px h-[16px] bg-white/30" />
            <span className="px-1 text-white text-[9px]">▾</span>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="채팅 옵션"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((isOpen) => !isOpen)}
              className="rounded-[4px] p-1 hover:bg-[#f0f0f0]"
            >
              <MoreIcon />
            </button>
            {moreOpen && (
              <TextSizeMenu
                value={textSize}
                onChange={setTextSize}
                onClose={() => setMoreOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <p
              className="font-semibold text-[#1b1b1b]"
              style={{ fontSize: `${textSize + 2}px` }}
            >
              무엇을 도와드릴까요?
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          const userColor = userColors.get(getChatUserKey(m)) ?? getChatUserColor(0);
          return m.by === myRole ? (
            <div key={i} className="flex flex-col items-end">
              <span
                className="rounded-2xl px-3 py-2 max-w-[240px] break-words text-[#1b1b1b]"
                style={{
                  fontSize: `${textSize}px`,
                  backgroundColor: userColor.surface,
                  border: `1px solid ${userColor.accent}55`,
                }}
              >
                {m.text}
              </span>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start">
              <span
                className="mb-0.5 font-semibold"
                style={{ fontSize: `${Math.max(textSize - 3, 9)}px`, color: userColor.accent }}
              >
                {m.name}
              </span>
              <span
                className="max-w-[250px] break-words rounded-r-xl px-2 py-1.5 leading-relaxed"
                style={{
                  fontSize: `${textSize}px`,
                  color: userColor.accent,
                  backgroundColor: userColor.surface,
                  borderLeft: `3px solid ${userColor.accent}`,
                }}
              >
                {m.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* input */}
      <div className="px-3 pb-3">
        <div className="bg-white border border-[#d8d8dc] rounded-[16px] shadow-sm px-3 pt-2.5 pb-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            maxLength={200}
            placeholder="Copilot에 메시지 보내기"
            className="w-full outline-none text-[#1b1b1b] placeholder:text-[#8a8a8e] bg-transparent"
            style={{ fontSize: `${textSize}px` }}
          />
          <div className="flex items-center justify-end pt-1.5">
            <button
              type="button"
              onClick={handleSend}
              className="bg-[#0f6cbd] hover:bg-[#0b5a9f] text-white rounded-[4px] px-3 py-1"
              style={{ fontSize: `${Math.max(textSize - 1, 10)}px` }}
            >
              보내기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
