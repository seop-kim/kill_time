"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateUserId, loadNickname } from "@/lib/identity";
import { ensureWallet, exchangeCoinMoney, getWalletForAction, subscribeWallet, type WalletProfile } from "@/lib/wallet";
import { ExchangeSheet, type ExchangeDirection } from "@/components/ExchangeSheet";
import { WorkspaceChrome } from "@/components/WorkspaceChrome";
import { useToast } from "@/components/Toast";
import { ensureFirebaseAuth } from "@/lib/firebase";
import { subscribeUserStats, type GameStats } from "@/lib/stats";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, type AdminEconomySettings } from "@/lib/adminEconomy";
import { loadPublicEconomySettings } from "@/lib/publicEconomy";

export default function ExchangePage() {
  const router = useRouter();
  const showToast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [wallet, setWallet] = useState<WalletProfile>({ coin: 0, money: 0 });
  const [profileStats, setProfileStats] = useState<Record<string, GameStats>>({});
  const [economySettings, setEconomySettings] = useState<AdminEconomySettings>(DEFAULT_ADMIN_ECONOMY_SETTINGS);

  useEffect(() => {
    let active = true;
    loadPublicEconomySettings().then((settings) => {
      if (active) setEconomySettings(settings);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const storedNickname = loadNickname();
    if (!storedNickname) {
      router.replace("/");
      return;
    }
    const id = getOrCreateUserId();
    // The identity is browser-only; initialize it after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(id);
    setNickname(storedNickname);
    ensureWallet(id).catch(() => showToast("지갑을 불러오지 못했습니다.", "error"));
    return subscribeWallet(id, setWallet);
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

  async function handleExchange(direction: ExchangeDirection, amount: number) {
    if (!userId) return;
    try {
      await exchangeCoinMoney(userId, direction, amount, Date.now(), economySettings);
      setWallet(await getWalletForAction(userId));
      showToast("환전이 완료되었습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "환전을 처리하지 못했습니다.", "error");
    }
  }

  if (!userId || !nickname) return <div className="flex-1" />;
  return (
    <WorkspaceChrome
      nickname={nickname}
      activeSheetId="exchange"
      onNavigateHome={() => router.push("/workspace")}
      profileStats={profileStats}
    >
      <ExchangeSheet wallet={wallet} onExchange={handleExchange} coinToMoneyRate={economySettings.coinToMoneyRate} />
    </WorkspaceChrome>
  );
}
