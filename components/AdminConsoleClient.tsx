"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, type AdminEconomySettings } from "@/lib/adminEconomy";
import { ExcelChrome, type ChromeAvatar, type GameTab } from "@/components/ExcelChrome";
import { WorkCoverSheet } from "@/components/WorkCoverSheet";
import { useToast } from "@/components/Toast";

type AdminTab = "economy" | "wallet" | "chat" | "records";
type AdminUser = { userId: string; nickname: string; coin: number; money: number; games: Record<string, unknown> };
type ChatLog = { id: string; roomCode: string; name: string; text: string; by: string; at: number };
type GameRecord = {
  id: string;
  roomCode: string;
  gameId: string;
  startedAt: number;
  finishedAt: number;
  participants: Array<{ participantId: string; userId?: string; name: string }>;
  outcome: Record<string, unknown>;
};

const ADMIN_TABS: GameTab[] = [
  { id: "economy", label: "경제 설정", available: true },
  { id: "wallet", label: "지갑 지급", available: true },
  { id: "chat", label: "채팅 로그", available: true },
  { id: "records", label: "게임 기록", available: true },
];

const ADMIN_AVATAR: ChromeAvatar = {
  id: "administrator",
  name: "관리자",
  color: "#217346",
  isTurn: false,
  online: true,
};

function formatAmount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatAt(value: number) {
  return value ? new Date(value).toLocaleString("ko-KR") : "-";
}

function GridSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-h-0 overflow-auto bg-white">
      <div className="absolute inset-0 min-w-[1440px] min-h-[760px] bg-[linear-gradient(#e8edf3_1px,transparent_1px),linear-gradient(90deg,#e8edf3_1px,transparent_1px)] bg-[size:100%_26px,100px_100%]" />
      <div className="relative min-w-[1440px] px-[50px] pt-[26px] pb-16">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-[900px] border border-[#b7c9e2] bg-white text-[13px] shadow-sm">
      <div className="border-b border-[#b7c9e2] bg-[#f2f6fb] px-3 py-[5px] font-semibold text-[#1f4e79]">{title}</div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="flex items-center gap-2 whitespace-nowrap text-[12px] text-[#555]">{children}</label>;
}

export function AdminConsoleClient() {
  const showToast = useToast();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("economy");
  const [sensitiveMode, setSensitiveMode] = useState(false);
  const [settings, setSettings] = useState<AdminEconomySettings>(DEFAULT_ADMIN_ECONOMY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantCurrency, setGrantCurrency] = useState<"coin" | "money">("coin");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [chatRoomCode, setChatRoomCode] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [recordGameId, setRecordGameId] = useState("");
  const [recordRoomCode, setRecordRoomCode] = useState("");
  const [records, setRecords] = useState<GameRecord[]>([]);

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    const payload = await response.json().catch(() => ({})) as T & { message?: string };
    if (response.status === 401) setAuthenticated(false);
    if (!response.ok) throw new Error(payload.message ?? "요청을 처리하지 못했습니다.");
    return payload;
  }

  async function loadDashboard() {
    try {
      setAdminError("");
      const [economyResponse, chatResponse, recordResponse] = await Promise.all([
        request<{ settings: AdminEconomySettings }>("/api/admin/economy"),
        request<{ logs: ChatLog[] }>("/api/admin/chat-logs?limit=50"),
        request<{ records: GameRecord[] }>("/api/admin/game-records?limit=50"),
      ]);
      setSettings(economyResponse.settings);
      setChatLogs(chatResponse.logs);
      setRecords(recordResponse.records);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    // The server session is only available after the browser mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    request<{ authenticated: boolean }>("/api/admin/session")
      .then(() => {
        setAuthenticated(true);
        void loadDashboard();
      })
      .catch(() => setAuthenticated(false));
    // The session check intentionally runs once on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    try {
      await request("/api/admin/login", { method: "POST", body: JSON.stringify({ loginId, password }) });
      setPassword("");
      setAuthenticated(true);
      await loadDashboard();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "로그인하지 못했습니다.", "error");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setUsers([]);
    setSelectedUser(null);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const response = await request<{ settings: AdminEconomySettings }>("/api/admin/economy", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(response.settings);
      showToast("경제 설정을 저장했습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "경제 설정을 저장하지 못했습니다.", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleFindUser() {
    try {
      const response = await request<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(userQuery)}`);
      setUsers(response.users);
      setSelectedUser(response.users[0] ?? null);
      if (response.users.length === 0) showToast("일치하는 사용자가 없습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "사용자를 찾지 못했습니다.", "error");
    }
  }

  async function handleGrant() {
    const amount = Number(grantAmount);
    if (!selectedUser || !Number.isSafeInteger(amount) || amount <= 0 || !grantReason.trim()) {
      showToast("지급 대상, 정수 금액, 사유를 입력해 주세요.", "error");
      return;
    }
    setGranting(true);
    try {
      const result = await request<{ balanceAfter: number }>("/api/admin/wallet-grants", {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser.userId, currency: grantCurrency, amount, reason: grantReason }),
      });
      setSelectedUser((current) => current ? { ...current, [grantCurrency]: result.balanceAfter } : current);
      setUsers((current) => current.map((user) => user.userId === selectedUser.userId ? { ...user, [grantCurrency]: result.balanceAfter } : user));
      setGrantAmount("");
      setGrantReason("");
      showToast(`${selectedUser.nickname || selectedUser.userId}님에게 ${formatAmount(amount)} ${grantCurrency}을 지급했습니다.`, "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "지갑 지급을 완료하지 못했습니다.", "error");
    } finally {
      setGranting(false);
    }
  }

  async function searchChatLogs() {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (chatRoomCode.trim()) params.set("roomCode", chatRoomCode.trim());
      if (chatQuery.trim()) params.set("q", chatQuery.trim());
      setChatLogs((await request<{ logs: ChatLog[] }>(`/api/admin/chat-logs?${params}`)).logs);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "채팅 로그를 불러오지 못했습니다.", "error");
    }
  }

  async function searchRecords() {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (recordGameId) params.set("gameId", recordGameId);
      if (recordRoomCode.trim()) params.set("roomCode", recordRoomCode.trim());
      setRecords((await request<{ records: GameRecord[] }>(`/api/admin/game-records?${params}`)).records);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게임 기록을 불러오지 못했습니다.", "error");
    }
  }

  if (authenticated === null) return <div className="flex-1" />;

  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f3f2f1]">
        <form onSubmit={handleLogin} className="w-[360px] border border-[#c8c8c8] bg-white p-6 shadow-sm">
          <h1 className="text-[18px] font-semibold text-[#1f4e79]">관리자 로그인</h1>
          <p className="mt-1 text-[12px] text-[#666]">관리자 전용 문서입니다.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Label>아이디 <input value={loginId} onChange={(event) => setLoginId(event.target.value)} autoComplete="username" className="h-8 flex-1 border border-[#bfbfbf] px-2 outline-none focus:border-[#217346]" /></Label>
            <Label>비밀번호 <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="h-8 flex-1 border border-[#bfbfbf] px-2 outline-none focus:border-[#217346]" /></Label>
            <button type="submit" disabled={loggingIn} className="mt-2 h-8 bg-[#217346] text-[13px] font-medium text-white hover:bg-[#185c37] disabled:opacity-60">
              로그인
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <ExcelChrome
      fileName="관리자_운영대장"
      avatars={[ADMIN_AVATAR]}
      profileAvatar={ADMIN_AVATAR}
      onShare={() => {}}
      games={ADMIN_TABS}
      activeGameId={activeTab}
      onSelectGame={(id) => setActiveTab(id as AdminTab)}
      onLeave={handleLogout}
      sensitiveMode={sensitiveMode}
      onToggleSensitivity={() => setSensitiveMode((current) => !current)}
    >
      {sensitiveMode ? <WorkCoverSheet /> : (
        <GridSheet>
          {adminError ? <p className="mb-3 w-[900px] border border-[#d13438] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#a4262c]">{adminError}</p> : null}
          {activeTab === "economy" && (
            <Section title="경제 설정">
              <div className="grid grid-cols-[180px_180px_180px] gap-x-4 gap-y-3">
                <Label>1 coin 당 money <input type="number" min={1} step={1} value={settings.coinToMoneyRate} onChange={(event) => setSettings({ ...settings, coinToMoneyRate: Number(event.target.value) })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right outline-none focus:border-[#217346]" /></Label>
                <span className="col-span-2 self-center text-[11px] text-[#777]">현재 환율은 코인↔머니 교환과 즉시 교환 안내에 적용됩니다.</span>
                <Label>오목 승리 <input type="number" min={0} value={settings.rewards.omok.win} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, win: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>오목 패배 <input type="number" min={0} value={settings.rewards.omok.loss} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, loss: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>오목 무승부 <input type="number" min={0} value={settings.rewards.omok.draw} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, draw: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>기린 정답 <input type="number" min={0} value={settings.rewards.girin.answered} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, girin: { ...settings.rewards.girin, answered: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>기린 못 맞춤 <input type="number" min={0} value={settings.rewards.girin.stumped} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, girin: { ...settings.rewards.girin, stumped: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>지뢰찾기 클리어 <input type="number" min={0} value={settings.rewards.minesweeper.won} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, minesweeper: { ...settings.rewards.minesweeper, won: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
                <Label>지뢰찾기 실패 <input type="number" min={0} value={settings.rewards.minesweeper.lost} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, minesweeper: { ...settings.rewards.minesweeper, lost: Number(event.target.value) } } })} className="h-7 w-20 border border-[#bfbfbf] px-1 text-right" /></Label>
              </div>
              <button type="button" disabled={savingSettings} onClick={handleSaveSettings} className="mt-4 h-8 border border-[#217346] bg-[#eaf7ee] px-5 text-[12px] font-semibold text-[#185c37] hover:bg-[#d7f0df] disabled:opacity-60">저장</button>
            </Section>
          )}

          {activeTab === "wallet" && (
            <div className="flex flex-col gap-4">
              <Section title="사용자 조회">
                <div className="flex items-center gap-2">
                  <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="UUID 또는 표시 이름을 정확히 입력" className="h-8 w-[360px] border border-[#bfbfbf] px-2 outline-none focus:border-[#217346]" />
                  <button type="button" onClick={handleFindUser} className="h-8 border border-[#bfbfbf] px-4 text-[12px] hover:bg-[#f5f5f5]">조회</button>
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {users.map((user) => <button key={user.userId} type="button" onClick={() => setSelectedUser(user)} className={`flex w-full max-w-[720px] items-center gap-4 border px-2 py-1.5 text-left text-[12px] ${selectedUser?.userId === user.userId ? "border-[#217346] bg-[#eaf7ee]" : "border-[#e2e2e2] hover:bg-[#f8f8f8]"}`}><span className="w-20 font-medium">{user.nickname || "(이름 없음)"}</span><span className="w-[290px] text-[#777]">{user.userId}</span><span>coin {formatAmount(user.coin)}</span><span>money {formatAmount(user.money)}</span></button>)}
                </div>
              </Section>
              <Section title="코인 · 머니 지급">
                <div className="flex flex-wrap items-end gap-3">
                  <Label>대상 <input readOnly value={selectedUser ? `${selectedUser.nickname || "이름 없음"} (${selectedUser.userId})` : "조회 후 선택"} className="h-8 w-[360px] border border-[#d2d2d2] bg-[#fafafa] px-2 text-[#666]" /></Label>
                  <Label>통화 <select value={grantCurrency} onChange={(event) => setGrantCurrency(event.target.value as "coin" | "money")} className="h-8 border border-[#bfbfbf] px-2"><option value="coin">coin</option><option value="money">money</option></select></Label>
                  <Label>금액 <input type="number" min={1} step={1} value={grantAmount} onChange={(event) => setGrantAmount(event.target.value)} className="h-8 w-28 border border-[#bfbfbf] px-2 text-right" /></Label>
                  <Label>사유 <input value={grantReason} maxLength={200} onChange={(event) => setGrantReason(event.target.value)} className="h-8 w-48 border border-[#bfbfbf] px-2" /></Label>
                  <button type="button" disabled={granting} onClick={handleGrant} className="h-8 border border-[#217346] bg-[#eaf7ee] px-4 text-[12px] font-semibold text-[#185c37] disabled:opacity-60">지급</button>
                </div>
              </Section>
            </div>
          )}

          {activeTab === "chat" && (
            <Section title="채팅 로그">
              <div className="mb-3 flex gap-2"><input value={chatRoomCode} onChange={(event) => setChatRoomCode(event.target.value)} placeholder="문서 코드" className="h-8 w-32 border border-[#bfbfbf] px-2" /><input value={chatQuery} onChange={(event) => setChatQuery(event.target.value)} placeholder="이름 또는 채팅 내용" className="h-8 w-56 border border-[#bfbfbf] px-2" /><button type="button" onClick={searchChatLogs} className="h-8 border border-[#bfbfbf] px-4 text-[12px] hover:bg-[#f5f5f5]">조회</button></div>
              <div className="max-h-[520px] overflow-auto border border-[#d9e2f3]"><table className="w-full border-collapse text-[12px]"><thead className="sticky top-0 bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1">시각</th><th className="border p-1">문서</th><th className="border p-1">이름</th><th className="border p-1">내용</th></tr></thead><tbody>{chatLogs.map((log) => <tr key={`${log.roomCode}:${log.id}`}><td className="border px-2 py-1 whitespace-nowrap">{formatAt(log.at)}</td><td className="border px-2 py-1">{log.roomCode}</td><td className="border px-2 py-1">{log.name}</td><td className="border px-2 py-1">{log.text}</td></tr>)}</tbody></table></div>
            </Section>
          )}

          {activeTab === "records" && (
            <Section title="게임 기록">
              <div className="mb-3 flex gap-2"><select value={recordGameId} onChange={(event) => setRecordGameId(event.target.value)} className="h-8 border border-[#bfbfbf] px-2"><option value="">전체 게임</option><option value="omok">Omok</option><option value="girin">girin</option><option value="seotda">Up</option><option value="minesweeper">지뢰찾기</option></select><input value={recordRoomCode} onChange={(event) => setRecordRoomCode(event.target.value)} placeholder="문서 코드" className="h-8 w-32 border border-[#bfbfbf] px-2" /><button type="button" onClick={searchRecords} className="h-8 border border-[#bfbfbf] px-4 text-[12px] hover:bg-[#f5f5f5]">조회</button></div>
              <div className="max-h-[520px] overflow-auto border border-[#d9e2f3]"><table className="w-full border-collapse text-[12px]"><thead className="sticky top-0 bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1">종료 시각</th><th className="border p-1">게임</th><th className="border p-1">문서</th><th className="border p-1">참여자</th><th className="border p-1">결과</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td className="border px-2 py-1 whitespace-nowrap">{formatAt(record.finishedAt)}</td><td className="border px-2 py-1">{record.gameId}</td><td className="border px-2 py-1">{record.roomCode}</td><td className="border px-2 py-1">{record.participants.map((participant) => participant.name).join(", ")}</td><td className="border px-2 py-1">{JSON.stringify(record.outcome)}</td></tr>)}</tbody></table></div>
            </Section>
          )}
        </GridSheet>
      )}
    </ExcelChrome>
  );
}
