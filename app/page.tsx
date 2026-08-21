"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateUserId, loadNickname, saveNickname } from "@/lib/identity";
import { saveProfileNickname } from "@/lib/profile";
import { ensureWallet } from "@/lib/wallet";
import { useToast } from "@/components/Toast";
import { NicknameSetupCard } from "@/components/HomeAccess";

export default function Home() {
  const router = useRouter();
  const showToast = useToast();

  const [name, setName] = useState(() => loadNickname());
  const [busy, setBusy] = useState(false);

  function validName(): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 8) {
      showToast("표시 이름은 2~8자로 입력해 주세요.", "error");
      return false;
    }
    return true;
  }

  async function handleContinue() {
    if (!validName() || busy) return;
    setBusy(true);
    try {
      const nickname = name.trim();
      const userId = getOrCreateUserId();
      saveNickname(nickname);
      await Promise.all([saveProfileNickname(userId, nickname), ensureWallet(userId)]);
      router.push("/workspace");
    } catch {
      showToast("사용자 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <NicknameSetupCard
        name={name}
        busy={busy}
        onNameChange={setName}
        onContinue={handleContinue}
      />
    </div>
  );
}
