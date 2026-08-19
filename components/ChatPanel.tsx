"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, PlayerRole } from "@/lib/rooms";

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
const PlusIcon = () => (
  <CIcon size={16}>
    <line x1="8" y1="3.5" x2="8" y2="12.5" />
    <line x1="3.5" y1="8" x2="12.5" y2="8" />
  </CIcon>
);

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
  myRole: PlayerRole;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  if (!open) return null;

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[320px] shadow-2xl z-[90] flex flex-col bg-[#fbfbfd] font-sheet">
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
          <MoreIcon />
        </div>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <p className="text-[15px] font-semibold text-[#1b1b1b]">무엇을 도와드릴까요?</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.by === myRole ? (
            <div key={i} className="flex flex-col items-end">
              <span
                className="text-[13px] rounded-2xl px-3 py-2 max-w-[240px] break-words bg-[#e9eef6] text-[#1b1b1b]"
              >
                {m.text}
              </span>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start">
              <span className="text-[10px] text-[#8a8a8e] mb-0.5">{m.name}</span>
              <span className="text-[13px] text-[#1b1b1b] max-w-[250px] break-words leading-relaxed">
                {m.text}
              </span>
            </div>
          ),
        )}
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
            className="w-full outline-none text-[13px] text-[#1b1b1b] placeholder:text-[#8a8a8e] bg-transparent"
          />
          <div className="flex items-center justify-between pt-1.5">
            <button onClick={handleSend} className="text-[#616161] hover:text-[#1b1b1b]">
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
