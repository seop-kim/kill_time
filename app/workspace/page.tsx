"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/rooms";
import { getOrCreateUserId, loadNickname, saveIdentity } from "@/lib/identity";
import { ensureWallet, getKstDateKey, claimDailyAttendance, subscribeAttendance, subscribeWallet, type WalletProfile } from "@/lib/wallet";
import { saveProfileNickname } from "@/lib/profile";
import { useToast } from "@/components/Toast";
import { DocumentJoinDialog } from "@/components/HomeAccess";
import { WorkspaceHome } from "@/components/WorkspaceHome";

export default function WorkspacePage() {
  const router = useRouter();
  const showToast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [wallet, setWallet] = useState<WalletProfile>({ coin: 0, money: 0 });
  const [attendanceClaimed, setAttendanceClaimed] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  useEffect(() => {
    const id = getOrCreateUserId();
    const storedName = loadNickname();
    if (!storedName) {
      router.replace("/");
      return;
    }
    // The identity is browser-only; initialize it after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(id);
    setNickname(storedName);
    Promise.all([saveProfileNickname(id, storedName), ensureWallet(id)]).catch(() => {
      showToast("사용자 정보를 불러오지 못했습니다.", "error");
    });
    return subscribeWallet(id, setWallet);
  }, [router, showToast]);

  useEffect(() => {
    if (!userId) return;
    return subscribeAttendance(userId, getKstDateKey(), setAttendanceClaimed);
  }, [userId]);

  async function handleCreateDocument() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const code = await createRoom(nickname);
      saveIdentity(code, { role: "host", name: nickname, userId });
      router.push(`/room/${code}`);
    } catch {
      showToast("문서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinDocument() {
    if (!userId || busy) return;
    const code = normalizeRoomCode(roomCode);
    if (code.length !== ROOM_CODE_LENGTH) {
      showToast(`문서 코드는 ${ROOM_CODE_LENGTH}자입니다.`, "error");
      return;
    }
    setBusy(true);
    try {
      const result = await joinRoom(code, nickname);
      if (!result.ok) {
        if (result.reason === "not-found") {
          router.push(`/room/${code}`);
          return;
        }
        showToast("이미 인원이 가득한 문서입니다.", "error");
        return;
      }
      saveIdentity(code, { role: result.role, name: nickname, participantId: result.participantId, userId });
      setJoinOpen(false);
      router.push(`/room/${code}`);
    } catch {
      showToast("문서를 여는 중 문제가 발생했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttendance() {
    if (!userId || attendanceClaimed || attendanceBusy) return;
    setAttendanceBusy(true);
    try {
      const claimed = await claimDailyAttendance(userId);
      showToast(claimed ? "출석체크 완료! 500 coin을 받았습니다." : "오늘은 이미 출석체크했습니다.", claimed ? "info" : "error");
    } catch {
      showToast("출석체크를 처리하지 못했습니다.", "error");
    } finally {
      setAttendanceBusy(false);
    }
  }

  if (!userId || !nickname) return <div className="flex-1" />;

  return (
    <>
      <WorkspaceHome
        nickname={nickname}
        wallet={wallet}
        attendanceClaimed={attendanceClaimed}
        attendanceBusy={attendanceBusy}
        onCreateDocument={handleCreateDocument}
        onOpenJoin={() => setJoinOpen(true)}
        onOpenExchange={() => router.push("/workspace/exchange")}
        onClaimAttendance={handleAttendance}
      />
      <DocumentJoinDialog
        open={joinOpen}
        roomCode={roomCode}
        busy={busy}
        onChange={setRoomCode}
        onClose={() => setJoinOpen(false)}
        onJoin={handleJoinDocument}
        roomCodeLength={ROOM_CODE_LENGTH}
      />
    </>
  );
}
