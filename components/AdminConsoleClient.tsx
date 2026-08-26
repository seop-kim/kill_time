"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DEFAULT_ADMIN_ECONOMY_SETTINGS, type AdminEconomySettings } from "@/lib/adminEconomy";
import { ExcelChrome, type ChromeAvatar, type GameTab } from "@/components/ExcelChrome";
import { WorkCoverSheet } from "@/components/WorkCoverSheet";
import { useToast } from "@/components/Toast";
import { AdminCellSheet, AdminSheetArea } from "@/components/AdminCellSheet";
import { ADMIN_SHEET_LAYOUT } from "@/lib/adminSheetLayout";

type AdminTab = "economy" | "wallet" | "chat" | "records";
type AdminUser = { userId: string; nickname: string; coin: number; money: number; games: Record<string, unknown> };
type ChatLog = { id: string; roomCode: string; name: string; text: string; by: string; participantId?: string; at: number };
type WalletLedger = { id: string; type: string; currency: "coin" | "money"; amount: number; balanceAfter: number; createdAt: number; reason: string; administrator: string };
type GameRecord = { id: string; roomCode: string; gameId: string; startedAt: number; finishedAt: number; participants: Array<{ participantId: string; userId?: string; name: string }>; outcome: Record<string, unknown> };
type UserDetail = AdminUser & { walletLedger: WalletLedger[]; chatLogs: ChatLog[]; gameRecords: GameRecord[] };
type RoomSummary = { roomCode: string; count: number; latestAt: number; preview: string };

const ADMIN_TABS: GameTab[] = [
  { id: "economy", label: "경제 설정", available: true },
  { id: "wallet", label: "지갑 지급", available: true },
  { id: "chat", label: "채팅 로그", available: true },
  { id: "records", label: "게임 기록", available: true },
];

const ADMIN_AVATAR: ChromeAvatar = { id: "administrator", name: "관리자", color: "#217346", isTurn: false, online: true };

function formatAmount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatAt(value: number) {
  return value ? new Date(value).toLocaleString("ko-KR") : "-";
}

function formatGameId(gameId: string) {
  return ({ omok: "오목", girin: "내가그린기린그림", seotda: "Up", minesweeper: "지뢰찾기", numberBaseball: "숫자야구" } as Record<string, string>)[gameId] ?? gameId;
}

function formatOutcome(outcome: Record<string, unknown>) {
  const entries = Object.entries(outcome);
  return entries.length ? entries.map(([key, value]) => key + ": " + (Array.isArray(value) ? value.join(", ") : String(value))).join(" · ") : "-";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="h-full text-[13px]"><div className="flex h-[36px] items-center border-b-2 border-[#222] px-3 font-semibold text-[#222]">{title}</div><div>{children}</div></section>;
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`flex min-w-0 items-center justify-between gap-2 whitespace-nowrap text-[12px] text-[#444] ${className}`}>{children}</label>;
}

function PaneHeading({ children }: { children: ReactNode }) {
  return <div className="flex h-[36px] items-center border-b-2 border-[#222] px-2 font-semibold text-[#222]">{children}</div>;
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b border-[#222] last:border-b-0"><div className="flex h-[34px] items-center border-b border-[#222] px-2 font-semibold text-[#222]">{title}</div><div className="p-2">{children}</div></section>;
}

function EmptyDetail({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-[200px] items-center justify-center text-[#777]">{children}</div>;
}

function DataTable({ children }: { children: ReactNode }) {
  return <div className="max-h-[118px] overflow-auto border border-[#222]"><table className="w-full border-collapse">{children}</table></div>;
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [grantCurrency, setGrantCurrency] = useState<"coin" | "money">("coin");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [chatRooms, setChatRooms] = useState<RoomSummary[]>([]);
  const [selectedChatRoomCode, setSelectedChatRoomCode] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [chatQuery, setChatQuery] = useState("");
  const [loadingChatLogs, setLoadingChatLogs] = useState(false);
  const [recordRooms, setRecordRooms] = useState<RoomSummary[]>([]);
  const [selectedRecordRoomCode, setSelectedRecordRoomCode] = useState<string | null>(null);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [recordGameId, setRecordGameId] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    const payload = await response.json().catch(() => ({})) as T & { message?: string };
    if (response.status === 401) setAuthenticated(false);
    if (!response.ok) throw new Error(payload.message ?? "요청을 처리하지 못했습니다.");
    return payload;
  }

  async function selectUser(userId: string) {
    setSelectedUserId(userId);
    setUserDetail(null);
    setLoadingUserDetail(true);
    try {
      const response = await request<{ user: UserDetail }>("/api/admin/users/" + encodeURIComponent(userId));
      setUserDetail(response.user);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "사용자 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoadingUserDetail(false);
    }
  }

  async function loadUsers(query = userQuery): Promise<AdminUser[]> {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const response = await request<{ users: AdminUser[] }>("/api/admin/users" + (params.size ? "?" + params.toString() : ""));
    setUsers(response.users);
    return response.users;
  }

  async function loadChatLogs(roomCode: string, query = chatQuery) {
    setSelectedChatRoomCode(roomCode);
    setLoadingChatLogs(true);
    try {
      const params = new URLSearchParams({ roomCode, limit: "200" });
      if (query.trim()) params.set("q", query.trim());
      const response = await request<{ logs: ChatLog[] }>("/api/admin/chat-logs?" + params.toString());
      setChatLogs(response.logs);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "채팅 로그를 불러오지 못했습니다.", "error");
    } finally {
      setLoadingChatLogs(false);
    }
  }

  async function loadGameRecords(roomCode: string, gameId = recordGameId) {
    setSelectedRecordRoomCode(roomCode);
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams({ roomCode, limit: "200" });
      if (gameId) params.set("gameId", gameId);
      const response = await request<{ records: GameRecord[] }>("/api/admin/game-records?" + params.toString());
      setRecords(response.records);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게임 기록을 불러오지 못했습니다.", "error");
    } finally {
      setLoadingRecords(false);
    }
  }

  async function loadDashboard() {
    try {
      setAdminError("");
      const [economyResponse, userResponse, chatRoomResponse, gameRoomResponse] = await Promise.all([
        request<{ settings: AdminEconomySettings }>("/api/admin/economy"),
        request<{ users: AdminUser[] }>("/api/admin/users"),
        request<{ rooms: RoomSummary[] }>("/api/admin/chat-rooms"),
        request<{ rooms: RoomSummary[] }>("/api/admin/game-rooms"),
      ]);
      setSettings(economyResponse.settings);
      setUsers(userResponse.users);
      setChatRooms(chatRoomResponse.rooms);
      setRecordRooms(gameRoomResponse.rooms);
      if (userResponse.users[0]) void selectUser(userResponse.users[0].userId);
      if (chatRoomResponse.rooms[0]) void loadChatLogs(chatRoomResponse.rooms[0].roomCode, "");
      if (gameRoomResponse.rooms[0]) void loadGameRecords(gameRoomResponse.rooms[0].roomCode, "");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    // The session response initializes the browser-only administrator session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    request<{ authenticated: boolean }>("/api/admin/session")
      .then(() => { setAuthenticated(true); void loadDashboard(); })
      .catch(() => setAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
    setUserDetail(null);
    setChatRooms([]);
    setRecordRooms([]);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const response = await request<{ settings: AdminEconomySettings }>("/api/admin/economy", { method: "PUT", body: JSON.stringify(settings) });
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
      const foundUsers = await loadUsers();
      const nextUser = foundUsers.find((user) => user.userId === selectedUserId) ?? foundUsers[0];
      if (nextUser) {
        await selectUser(nextUser.userId);
      } else {
        setSelectedUserId(null);
        setUserDetail(null);
        showToast("일치하는 사용자가 없습니다.", "info");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "사용자를 찾지 못했습니다.", "error");
    }
  }

  async function handleGrant() {
    const amount = Number(grantAmount);
    if (!userDetail || !Number.isSafeInteger(amount) || amount === 0 || !grantReason.trim()) {
      showToast("대상, 0이 아닌 정수 금액, 사유를 입력해 주세요.", "error");
      return;
    }
    setGranting(true);
    try {
      await request<{ balanceAfter: number }>("/api/admin/wallet-grants", {
        method: "POST",
        body: JSON.stringify({ userId: userDetail.userId, currency: grantCurrency, amount, reason: grantReason }),
      });
      setGrantAmount("");
      setGrantReason("");
      await loadUsers();
      await selectUser(userDetail.userId);
      const action = amount < 0 ? "회수" : "지급";
      showToast((userDetail.nickname || userDetail.userId) + "님의 " + grantCurrency + " " + formatAmount(Math.abs(amount)) + "을 " + action + "했습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "지갑 지급을 완료하지 못했습니다.", "error");
    } finally {
      setGranting(false);
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
            <button type="submit" disabled={loggingIn} className="mt-2 h-8 bg-[#217346] text-[13px] font-medium text-white hover:bg-[#185c37] disabled:opacity-60">로그인</button>
          </div>
        </form>
      </div>
    );
  }

  const userMaster = (
    <>
      <PaneHeading>사용자 목록</PaneHeading>
      <div className="flex gap-1 border-b border-[#d9e2f3] p-2">
        <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleFindUser(); }} placeholder="UUID 또는 표시 이름" className="h-7 min-w-0 flex-1 border border-[#bfbfbf] px-2 outline-none focus:border-[#217346]" />
        <button type="button" onClick={() => void handleFindUser()} className="h-7 border border-[#bfbfbf] px-2 hover:bg-[#f5f5f5]">조회</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {users.map((user) => <button key={user.userId} type="button" onClick={() => void selectUser(user.userId)} className={"block w-full border-b border-[#e3eaf4] px-3 py-2 text-left hover:bg-[#f8fbff] " + (selectedUserId === user.userId ? "bg-[#eaf7ee]" : "bg-white")}><span className="block font-medium text-[#222]">{user.nickname || "(이름 없음)"}</span><span className="mt-0.5 block truncate text-[11px] text-[#777]">{user.userId}</span><span className="mt-1 block text-[11px] text-[#555]">coin {formatAmount(user.coin)} · money {formatAmount(user.money)}</span></button>)}
        {users.length === 0 ? <p className="p-3 text-[#777]">표시할 사용자가 없습니다.</p> : null}
      </div>
    </>
  );

  const chatMaster = (
    <>
      <PaneHeading>문서별 채팅 로그</PaneHeading>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chatRooms.map((room) => <button key={room.roomCode} type="button" onClick={() => void loadChatLogs(room.roomCode, "")} className={"block w-full border-b border-[#e3eaf4] px-3 py-2 text-left hover:bg-[#f8fbff] " + (selectedChatRoomCode === room.roomCode ? "bg-[#eaf7ee]" : "bg-white")}><span className="block font-medium text-[#222]">{room.roomCode} <span className="font-normal text-[#777]">({room.count})</span></span><span className="mt-0.5 block truncate text-[11px] text-[#777]">{room.preview || "(내용 없음)"}</span><span className="mt-1 block text-[11px] text-[#777]">{formatAt(room.latestAt)}</span></button>)}
        {chatRooms.length === 0 ? <p className="p-3 text-[#777]">저장된 채팅 로그가 없습니다.</p> : null}
      </div>
    </>
  );

  const recordMaster = (
    <>
      <PaneHeading>문서별 게임 기록</PaneHeading>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {recordRooms.map((room) => <button key={room.roomCode} type="button" onClick={() => void loadGameRecords(room.roomCode, recordGameId)} className={"block w-full border-b border-[#e3eaf4] px-3 py-2 text-left hover:bg-[#f8fbff] " + (selectedRecordRoomCode === room.roomCode ? "bg-[#eaf7ee]" : "bg-white")}><span className="block font-medium text-[#222]">{room.roomCode} <span className="font-normal text-[#777]">({room.count})</span></span><span className="mt-0.5 block text-[11px] text-[#777]">최근 게임: {formatGameId(room.preview)}</span><span className="mt-1 block text-[11px] text-[#777]">{formatAt(room.latestAt)}</span></button>)}
        {recordRooms.length === 0 ? <p className="p-3 text-[#777]">저장된 게임 기록이 없습니다.</p> : null}
      </div>
    </>
  );

  const userDetailPane = loadingUserDetail ? <EmptyDetail>사용자 정보를 불러오는 중입니다.</EmptyDetail> : userDetail ? (
    <>
      <DetailBlock title="사용자 정보"><div className="grid grid-cols-[120px_1fr] gap-y-1.5"><span className="text-[#666]">표시 이름</span><strong>{userDetail.nickname || "(이름 없음)"}</strong><span className="text-[#666]">UUID</span><span className="break-all">{userDetail.userId}</span></div></DetailBlock>
      <DetailBlock title="지갑 상태 및 지급">
        <div className="grid grid-cols-2 border border-[#d9e2f3]"><div className="border-r border-[#d9e2f3] p-3"><span className="text-[#666]">보유 코인</span><strong className="ml-3 text-[15px]">{formatAmount(userDetail.coin)}</strong></div><div className="p-3"><span className="text-[#666]">보유 머니</span><strong className="ml-3 text-[15px]">{formatAmount(userDetail.money)}</strong></div></div>
        <div className="mt-3 flex flex-wrap items-end gap-3"><Label>통화 <select value={grantCurrency} onChange={(event) => setGrantCurrency(event.target.value as "coin" | "money")} className="h-8 border border-[#bfbfbf] px-2"><option value="coin">coin</option><option value="money">money</option></select></Label><Label>금액 <input type="number" step={1} value={grantAmount} onChange={(event) => setGrantAmount(event.target.value)} placeholder="음수는 회수" className="h-8 w-28 border border-[#bfbfbf] px-2 text-right" /></Label><Label>사유 <input value={grantReason} maxLength={200} onChange={(event) => setGrantReason(event.target.value)} className="h-8 w-56 border border-[#bfbfbf] px-2" /></Label><button type="button" disabled={granting} onClick={() => void handleGrant()} className="h-8 border border-[#217346] bg-[#eaf7ee] px-4 font-semibold text-[#185c37] disabled:opacity-60">지급 / 회수</button></div>
      </DetailBlock>
      <DetailBlock title="게임 전적"><div className="flex flex-wrap gap-x-5 gap-y-1">{Object.entries(userDetail.games).length ? Object.entries(userDetail.games).map(([gameId, stat]) => <span key={gameId}><strong>{formatGameId(gameId)}</strong> · {JSON.stringify(stat)}</span>) : <span className="text-[#777]">저장된 전적이 없습니다.</span>}</div><div className="mt-3"><DataTable><thead className="bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1 text-left">종료</th><th className="border p-1 text-left">게임</th><th className="border p-1 text-left">문서</th><th className="border p-1 text-left">결과</th></tr></thead><tbody>{userDetail.gameRecords.map((record) => <tr key={record.id}><td className="border px-2 py-1">{formatAt(record.finishedAt)}</td><td className="border px-2 py-1">{formatGameId(record.gameId)}</td><td className="border px-2 py-1">{record.roomCode}</td><td className="border px-2 py-1">{formatOutcome(record.outcome)}</td></tr>)}{userDetail.gameRecords.length === 0 ? <tr><td colSpan={4} className="border px-2 py-2 text-center text-[#777]">게임 기록이 없습니다.</td></tr> : null}</tbody></DataTable></div></DetailBlock>
      <DetailBlock title="최근 채팅 로그"><DataTable><thead className="bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1 text-left">시각</th><th className="border p-1 text-left">문서</th><th className="border p-1 text-left">내용</th></tr></thead><tbody>{userDetail.chatLogs.map((log) => <tr key={log.roomCode + ":" + log.id}><td className="border px-2 py-1">{formatAt(log.at)}</td><td className="border px-2 py-1">{log.roomCode}</td><td className="border px-2 py-1">{log.text}</td></tr>)}{userDetail.chatLogs.length === 0 ? <tr><td colSpan={3} className="border px-2 py-2 text-center text-[#777]">채팅 로그가 없습니다.</td></tr> : null}</tbody></DataTable></DetailBlock>
      <DetailBlock title="지갑 원장"><DataTable><thead className="bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1 text-left">시각</th><th className="border p-1 text-left">통화</th><th className="border p-1 text-right">지급</th><th className="border p-1 text-right">지급 후</th><th className="border p-1 text-left">사유</th></tr></thead><tbody>{userDetail.walletLedger.map((entry) => <tr key={entry.id}><td className="border px-2 py-1">{formatAt(entry.createdAt)}</td><td className="border px-2 py-1">{entry.currency}</td><td className="border px-2 py-1 text-right">{formatAmount(entry.amount)}</td><td className="border px-2 py-1 text-right">{formatAmount(entry.balanceAfter)}</td><td className="border px-2 py-1">{entry.reason || "-"}</td></tr>)}{userDetail.walletLedger.length === 0 ? <tr><td colSpan={5} className="border px-2 py-2 text-center text-[#777]">지갑 원장이 없습니다.</td></tr> : null}</tbody></DataTable></DetailBlock>
    </>
  ) : <EmptyDetail>왼쪽 목록에서 사용자를 선택해 주세요.</EmptyDetail>;

  const chatDetailPane = selectedChatRoomCode ? (
    <><PaneHeading>{selectedChatRoomCode} 채팅 로그</PaneHeading><div className="flex gap-2 border-b border-[#d9e2f3] p-2"><input value={chatQuery} onChange={(event) => setChatQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadChatLogs(selectedChatRoomCode); }} placeholder="이름 또는 채팅 내용" className="h-7 w-60 border border-[#bfbfbf] px-2 outline-none focus:border-[#217346]" /><button type="button" onClick={() => void loadChatLogs(selectedChatRoomCode)} className="h-7 border border-[#bfbfbf] px-3 hover:bg-[#f5f5f5]">검색</button></div><div className="max-h-[470px] overflow-auto"><table className="w-full border-collapse"><thead className="sticky top-0 bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1 text-left">시각</th><th className="border p-1 text-left">이름</th><th className="border p-1 text-left">내용</th></tr></thead><tbody>{chatLogs.map((log) => <tr key={log.roomCode + ":" + log.id}><td className="border px-2 py-1 whitespace-nowrap">{formatAt(log.at)}</td><td className="border px-2 py-1">{log.name}</td><td className="border px-2 py-1">{log.text}</td></tr>)}{!loadingChatLogs && chatLogs.length === 0 ? <tr><td colSpan={3} className="border px-2 py-3 text-center text-[#777]">표시할 채팅 로그가 없습니다.</td></tr> : null}</tbody></table>{loadingChatLogs ? <p className="p-3 text-[#777]">채팅 로그를 불러오는 중입니다.</p> : null}</div></>
  ) : <EmptyDetail>왼쪽 목록에서 문서를 선택해 주세요.</EmptyDetail>;

  const recordDetailPane = selectedRecordRoomCode ? (
    <><PaneHeading>{selectedRecordRoomCode} 게임 기록</PaneHeading><div className="flex gap-2 border-b border-[#d9e2f3] p-2"><select value={recordGameId} onChange={(event) => { const gameId = event.target.value; setRecordGameId(gameId); void loadGameRecords(selectedRecordRoomCode, gameId); }} className="h-7 border border-[#bfbfbf] px-2"><option value="">전체 게임</option><option value="omok">오목</option><option value="girin">내가그린기린그림</option><option value="seotda">Up</option><option value="minesweeper">지뢰찾기</option><option value="numberBaseball">숫자야구</option></select></div><div className="max-h-[470px] overflow-auto"><table className="w-full border-collapse"><thead className="sticky top-0 bg-[#f2f6fb] text-[#1f4e79]"><tr><th className="border p-1 text-left">종료 시각</th><th className="border p-1 text-left">게임</th><th className="border p-1 text-left">참여자</th><th className="border p-1 text-left">결과</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td className="border px-2 py-1 whitespace-nowrap">{formatAt(record.finishedAt)}</td><td className="border px-2 py-1">{formatGameId(record.gameId)}</td><td className="border px-2 py-1">{record.participants.map((participant) => participant.name).join(", ")}</td><td className="border px-2 py-1">{formatOutcome(record.outcome)}</td></tr>)}{!loadingRecords && records.length === 0 ? <tr><td colSpan={4} className="border px-2 py-3 text-center text-[#777]">표시할 게임 기록이 없습니다.</td></tr> : null}</tbody></table>{loadingRecords ? <p className="p-3 text-[#777]">게임 기록을 불러오는 중입니다.</p> : null}</div></>
  ) : <EmptyDetail>왼쪽 목록에서 문서를 선택해 주세요.</EmptyDetail>;

  const economySheet = (
    <AdminSheetArea {...ADMIN_SHEET_LAYOUT.economy} className="border-2 border-[#222]">
      <Section title="경제 설정">
        <div className="grid grid-cols-3">
          <Label className="h-[54px] border-b border-r border-[#222] px-3">코인 → 머니 (1 coin)<span className="flex items-center gap-1"><input type="number" min={1} step={1} value={settings.coinToMoneyRate} onChange={(event) => setSettings({ ...settings, coinToMoneyRate: Number(event.target.value) })} className="h-7 w-20 border border-[#777] px-1 text-right outline-none focus:border-[#217346]" />money</span></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">머니 → 코인 (1 coin)<span className="flex items-center gap-1"><input type="number" min={1} step={1} value={settings.moneyToCoinRate} onChange={(event) => setSettings({ ...settings, moneyToCoinRate: Number(event.target.value) })} className="h-7 w-20 border border-[#777] px-1 text-right outline-none focus:border-[#217346]" />money</span></Label>
          <div className="flex items-center border-b border-[#222] px-3 text-[11px] text-[#666]">두 환율은 독립적으로 설정됩니다.</div>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">오목 승리<input type="number" min={0} value={settings.rewards.omok.win} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, win: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">오목 패배<input type="number" min={0} value={settings.rewards.omok.loss} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, loss: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-[#222] px-3">오목 무승부<input type="number" min={0} value={settings.rewards.omok.draw} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, omok: { ...settings.rewards.omok, draw: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">기린 정답<input type="number" min={0} value={settings.rewards.girin.answered} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, girin: { ...settings.rewards.girin, answered: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">기린 못 맞춤<input type="number" min={0} value={settings.rewards.girin.stumped} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, girin: { ...settings.rewards.girin, stumped: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-[#222] px-3">지뢰찾기 클리어<input type="number" min={0} value={settings.rewards.minesweeper.won} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, minesweeper: { ...settings.rewards.minesweeper, won: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-r border-[#222] px-3">지뢰찾기 실패<input type="number" min={0} value={settings.rewards.minesweeper.lost} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, minesweeper: { ...settings.rewards.minesweeper, lost: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">숫자야구 승리<input type="number" min={0} value={settings.rewards.numberBaseball.win} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, numberBaseball: { ...settings.rewards.numberBaseball, win: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-r border-[#222] px-3">숫자야구 패배<input type="number" min={0} value={settings.rewards.numberBaseball.loss} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, numberBaseball: { ...settings.rewards.numberBaseball, loss: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <Label className="h-[54px] border-b border-[#222] px-3">숫자야구 무승부<input type="number" min={0} value={settings.rewards.numberBaseball.draw} onChange={(event) => setSettings({ ...settings, rewards: { ...settings.rewards, numberBaseball: { ...settings.rewards.numberBaseball, draw: Number(event.target.value) } } })} className="h-7 w-20 border border-[#777] px-1 text-right" /></Label>
          <div className="col-span-2 flex items-center px-3 text-[11px] text-[#666]">저장 즉시 모든 일반 게임의 보상 기준에 적용됩니다.</div>
        </div>
        <div className="flex h-[54px] items-center border-t border-[#222] px-3"><button type="button" disabled={savingSettings} onClick={() => void handleSaveSettings()} className="h-8 border border-[#217346] px-5 text-[12px] font-semibold text-[#185c37] hover:bg-[#eaf7ee] disabled:opacity-60">저장</button></div>
      </Section>
    </AdminSheetArea>
  );

  return (
    <ExcelChrome fileName="관리자_운영대장" avatars={[ADMIN_AVATAR]} profileAvatar={ADMIN_AVATAR} onShare={() => {}} games={ADMIN_TABS} activeGameId={activeTab} onSelectGame={(id) => setActiveTab(id as AdminTab)} onLeave={() => void handleLogout()} sensitiveMode={sensitiveMode} onToggleSensitivity={() => setSensitiveMode((current) => !current)}>
      {sensitiveMode ? <WorkCoverSheet /> : <AdminCellSheet>
        {adminError ? <AdminSheetArea col={1} row={27} colSpan={17} className="flex items-center border border-[#d13438] px-2 text-[#a4262c]">{adminError}</AdminSheetArea> : null}
        {activeTab === "economy" ? economySheet : null}
        {activeTab === "wallet" ? <><AdminSheetArea {...ADMIN_SHEET_LAYOUT.master} className="flex h-full flex-col border-2 border-[#222]">{userMaster}</AdminSheetArea><AdminSheetArea {...ADMIN_SHEET_LAYOUT.detail} className="h-full overflow-auto border-2 border-[#222]">{userDetailPane}</AdminSheetArea></> : null}
        {activeTab === "chat" ? <><AdminSheetArea {...ADMIN_SHEET_LAYOUT.master} className="flex h-full flex-col border-2 border-[#222]">{chatMaster}</AdminSheetArea><AdminSheetArea {...ADMIN_SHEET_LAYOUT.detail} className="h-full overflow-auto border-2 border-[#222]">{chatDetailPane}</AdminSheetArea></> : null}
        {activeTab === "records" ? <><AdminSheetArea {...ADMIN_SHEET_LAYOUT.master} className="flex h-full flex-col border-2 border-[#222]">{recordMaster}</AdminSheetArea><AdminSheetArea {...ADMIN_SHEET_LAYOUT.detail} className="h-full overflow-auto border-2 border-[#222]">{recordDetailPane}</AdminSheetArea></> : null}
      </AdminCellSheet>}
    </ExcelChrome>
  );
}
