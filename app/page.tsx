"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/rooms";
import { getOrCreateUserId, saveIdentity } from "@/lib/identity";
import { useToast } from "@/components/Toast";
import { DocumentJoinDialog, HomeAccessCard } from "@/components/HomeAccess";

export default function Home() {
  const router = useRouter();
  const showToast = useToast();

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
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
      saveIdentity(code, { role: "host", name: name.trim(), userId: getOrCreateUserId() });
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
      saveIdentity(code, {
        role: result.role,
        name: name.trim(),
        participantId: result.participantId,
        userId: getOrCreateUserId(),
      });
      setJoinOpen(false);
      router.push(`/room/${code}`);
    } catch {
      showToast("문서를 여는 중 문제가 발생했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <HomeAccessCard
        name={name}
        busy={busy}
        onNameChange={setName}
        onCreate={handleCreate}
        onOpenJoin={() => setJoinOpen(true)}
      />
      <DocumentJoinDialog
        open={joinOpen}
        roomCode={roomCode}
        busy={busy}
        onChange={setRoomCode}
        onClose={() => setJoinOpen(false)}
        onJoin={handleJoin}
        roomCodeLength={ROOM_CODE_LENGTH}
      />
    </div>
  );
}
