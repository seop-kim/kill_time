"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateUserId, loadNickname } from "@/lib/identity";
import { ensureWallet, exchangeCoinMoney, subscribeWallet, type WalletProfile } from "@/lib/wallet";
import { ExchangeSheet, type ExchangeDirection } from "@/components/ExchangeSheet";
import { useToast } from "@/components/Toast";

export default function ExchangePage() {
  const router = useRouter();
  const showToast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletProfile>({ coin: 0, money: 0 });

  useEffect(() => {
    const nickname = loadNickname();
    if (!nickname) {
      router.replace("/");
      return;
    }
    const id = getOrCreateUserId();
    // The identity is browser-only; initialize it after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(id);
    ensureWallet(id).catch(() => showToast("지갑을 불러오지 못했습니다.", "error"));
    return subscribeWallet(id, setWallet);
  }, [router, showToast]);

  async function handleExchange(direction: ExchangeDirection, amount: number) {
    if (!userId) return;
    try {
      await exchangeCoinMoney(userId, direction, amount);
      showToast("환전이 완료되었습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "환전을 처리하지 못했습니다.", "error");
    }
  }

  if (!userId) return <div className="flex-1" />;
  return <ExchangeSheet wallet={wallet} onExchange={handleExchange} onBack={() => router.push("/workspace")} />;
}
