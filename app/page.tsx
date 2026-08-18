"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/rooms";
import { saveIdentity } from "@/lib/identity";
import { useToast } from "@/components/Toast";

export default function Home() {
  const router = useRouter();
  const showToast = useToast();

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);

  function validName(): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 8) {
      showToast("표시 이름은 2~8자로 입력해 주세요.", "error");
      return false;
    }
    return true;
  }

  async function handleCreate() {
    if (!validName() || busy) return;
    setBusy(true);
    try {
      const code = await createRoom(name.trim());
      saveIdentity(code, { role: "host", name: name.trim() });
      router.push(`/room/${code}`);
    } catch {
      showToast("문서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!validName() || busy) return;
    const code = normalizeRoomCode(roomCode);
    if (code.length !== ROOM_CODE_LENGTH) {
      showToast(`문서 ID는 ${ROOM_CODE_LENGTH}자입니다.`, "error");
      return;
    }
    setBusy(true);
    try {
      const result = await joinRoom(code, name.trim());
      if (!result.ok) {
        showToast(
          result.reason === "not-found" ? "문서를 찾을 수 없습니다." : "이미 인원이 가득한 문서입니다.",
          "error",
        );
        return;
      }
      saveIdentity(code, { role: result.role, name: name.trim() });
      router.push(`/room/${code}`);
    } catch {
      showToast("문서를 여는 중 문제가 발생했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-[#d0d0d0] rounded-sm shadow-sm">
        <div className="border-b border-[#e0e0e0] px-5 py-3">
          <h1 className="text-[15px] font-semibold text-[#333]">문서 액세스</h1>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-[#555]">표시 이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={8}
              placeholder="예: 김철수"
              className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] outline-none focus:border-[#217346]"
            />
          </label>

          <button
            onClick={handleCreate}
            disabled={busy}
            className="bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-60 text-white text-[13px] rounded-sm py-2"
          >
            새 문서 만들기
          </button>

          <div className="flex items-center gap-2 text-[11px] text-[#999]">
            <div className="flex-1 h-px bg-[#e0e0e0]" />
            또는
            <div className="flex-1 h-px bg-[#e0e0e0]" />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-[#555]">문서 ID</span>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="예: AB3XQ2"
              className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] tracking-widest outline-none focus:border-[#217346] uppercase"
            />
          </label>

          <button
            onClick={handleJoin}
            disabled={busy}
            className="border border-[#217346] text-[#217346] hover:bg-[#f0f7f3] disabled:opacity-60 text-[13px] rounded-sm py-2"
          >
            문서 열기
          </button>
        </div>
      </div>
    </div>
  );
}
