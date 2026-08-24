"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, normalizeRoomCode, ROOM_CODE_LENGTH, type RoomGameId } from "@/lib/rooms";
import { canAffordSeotdaStake, SEOTDA_STAKE_MIN } from "@/lib/economy";
import { getOrCreateUserId, loadNickname, saveIdentity } from "@/lib/identity";
import { claimDailyAttendance, ensureWallet, getWalletForAction, subscribeWallet, type WalletProfile } from "@/lib/wallet";
import { useToast } from "@/components/Toast";
import { DocumentJoinDialog } from "@/components/HomeAccess";
import { WorkspaceHome } from "@/components/WorkspaceHome";
import { DocumentSettingsDialog } from "@/components/DocumentSettingsDialog";
import { ensureFirebaseAuth } from "@/lib/firebase";
import { subscribeUserStats, type GameStats } from "@/lib/stats";

export default function WorkspacePage() {
  const router = useRouter();
  const showToast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [wallet, setWallet] = useState<WalletProfile>({ coin: 0, money: 0 });
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [profileStats, setProfileStats] = useState<Record<string, GameStats>>({});
  const [joinOpen, setJoinOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createGameId, setCreateGameId] = useState<RoomGameId>("omok");
  const [createMoneyStake, setCreateMoneyStake] = useState(SEOTDA_STAKE_MIN);

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
    ensureWallet(id).catch(() => {
      showToast("지갑 정보를 불러오지 못했습니다.", "error");
    });
    return subscribeWallet(id, (nextWallet) => {
      setWallet(nextWallet);
      setWalletLoaded(true);
    });
  }, [router, showToast]);

  useEffect(() => {
    if (!userId) return undefined;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    ensureFirebaseAuth()
      .then(() => {
        if (!disposed) unsubscribe = subscribeUserStats(userId, (profile) => setProfileStats(profile.games));
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    claimDailyAttendance(userId)
      .then((claimed) => {
        if (claimed) showToast("오늘 출석체크 완료! 500 coin을 받았습니다.", "info");
      })
      .catch(() => {
        showToast("자동 출석체크를 처리하지 못했습니다.", "error");
      });
  }, [userId, showToast]);

  async function handleCreateDocument() {
    if (!userId || busy) return;
    let currentWallet = wallet;
    if (createGameId === "seotda") {
      try {
        currentWallet = await getWalletForAction(userId);
        setWallet(currentWallet);
        if (!canAffordSeotdaStake(currentWallet.money, createMoneyStake)) {
          showToast("Up 판돈보다 머니가 부족합니다.", "error");
          return;
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Up 판돈을 확인하지 못했습니다.", "error");
        return;
      }
    }
    setBusy(true);
    try {
      const code = await createRoom(nickname, createGameId, createMoneyStake, currentWallet.money, userId);
      saveIdentity(code, { role: "host", name: nickname, userId });
      setCreateOpen(false);
      router.push(`/room/${code}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "문서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
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
      const currentWallet = await getWalletForAction(userId);
      setWallet(currentWallet);
      const result = await joinRoom(code, nickname, currentWallet.money, userId);
      if (!result.ok) {
        if (result.reason === "not-found") {
          router.push(`/room/${code}`);
          return;
        }
        if (result.reason === "insufficient-funds") {
          showToast("Up 판돈보다 머니가 부족합니다.", "error");
          return;
        }
        if (result.reason === "solo-only") {
          showToast("지뢰찾기는 혼자 플레이하는 문서입니다.", "error");
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

  if (!userId || !nickname) return <div className="flex-1" />;

  return (
    <>
      <WorkspaceHome
        nickname={nickname}
        wallet={wallet}
        walletLoaded={walletLoaded}
        onCreateDocument={() => setCreateOpen(true)}
        onOpenJoin={() => setJoinOpen(true)}
        onOpenExchange={() => router.push("/workspace/exchange")}
        profileStats={profileStats}
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
      <DocumentSettingsDialog
        open={createOpen}
        title="문서 만들기"
        gameId={createGameId}
        moneyStake={createMoneyStake}
        submitLabel="문서 만들기"
        busy={busy}
        onGameChange={setCreateGameId}
        onMoneyStakeChange={setCreateMoneyStake}
        onSubmit={handleCreateDocument}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
