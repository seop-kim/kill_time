"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onValue, ref } from "firebase/database";
import { getDb } from "@/lib/firebase";
import {
  BOARD_SIZE,
  checkWin,
  getStone,
  isForbiddenBlackMove,
  withStone,
  type Stone,
} from "@/lib/gomoku";
import { columnLabel } from "@/lib/columnLabel";
import {
  acceptDraw,
  acceptUndo,
  armPresence,
  canRequestUndo,
  cancelDrawRequest,
  cancelUndoRequest,
  forfeit,
  getGameCandidates,
  joinRoom,
  leaveRoom,
  placeStone,
  rematch,
  requestDraw,
  requestUndo,
  sendChatMessage,
  skipTurn,
  startGame,
  subscribeChat,
  subscribeRoom,
  DISCONNECT_GRACE_MS,
  TURN_SECONDS,
  type ChatMessage,
  type ParticipantRole,
  type PlayerRole,
  type Room,
} from "@/lib/rooms";
import { loadIdentity, saveIdentity, type StoredIdentity } from "@/lib/identity";
import { useToast } from "@/components/Toast";
import {
  ExcelChrome,
  StartGameConfirmDialog,
  type ChromeAvatar,
  type GameTab,
} from "@/components/ExcelChrome";
import { ChatPanel } from "@/components/ChatPanel";
import { toggleChatOpen } from "@/lib/chat";

const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const CELL_W = 26;
const CELL_H = 22;
const HEADER_W = 40;
const MOVE_TAG_MS = 5000;

const GAMES: GameTab[] = [
  { id: "omok", label: "Omok", available: true },
  { id: "baseball", label: "Baseball", available: false },
  { id: "janggi", label: "Janggi", available: false },
];

function colorOf(role: PlayerRole, room: Room): Stone {
  return room.blackPlayer === role ? "black" : "white";
}

function opposite(role: PlayerRole): PlayerRole {
  return role === "host" ? "guest" : "host";
}

function nameOfRole(role: PlayerRole, room: Room): string | undefined {
  return role === "host" ? room.host.name : room.guest?.name;
}

function nameOfColor(color: Stone, room: Room): string | undefined {
  return colorOf("host", room) === color ? room.host.name : room.guest?.name;
}

function effectiveRoleOf(identity: StoredIdentity, room: Room): ParticipantRole {
  if (identity.role === "host") return "host";
  const guestId = room.guest?.id;
  if (
    room.guest &&
    ((identity.participantId && guestId === identity.participantId) ||
      (!identity.participantId && identity.role === "guest" && room.guest.name === identity.name))
  ) {
    return "guest";
  }
  return "spectator";
}

export default function RoomClient({ code }: { code: string }) {
  const showToast = useToast();
  const router = useRouter();

  const [identity, setIdentity] = useState<StoredIdentity | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [showMoveTag, setShowMoveTag] = useState(false);
  const [opponentPickerOpen, setOpponentPickerOpen] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  const prevStatusRef = useRef<Room["status"] | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const lastMoveInitRef = useRef(false);
  const prevLastMoveRef = useRef<Room["lastMove"]>(null);
  const prevTurnStartedAtRef = useRef<number | undefined>(undefined);
  const prevPlayingStatusRef = useRef<Room["status"] | null>(null);
  const moveTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentPresenceInitRef = useRef(false);
  const prevOpponentOnlineRef = useRef<boolean | undefined>(undefined);
  const centeredOnceRef = useRef(false);

  const effectiveRole = room && identity ? effectiveRoleOf(identity, room) : null;
  const playerRole: PlayerRole | null = effectiveRole === "host" || effectiveRole === "guest" ? effectiveRole : null;

  useEffect(() => {
    // localStorage doesn't exist during SSR, so this can only run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentity(loadIdentity(code));
  }, [code]);

  useEffect(() => {
    try {
      const unsubscribe = subscribeRoom(code, (r) => {
        setRoom(r);
        setRoomLoaded(true);
      });
      return unsubscribe;
    } catch {
      // e.g. Firebase isn't configured yet (missing/invalid env vars). Setting
      // state here (rather than via a subscription callback) is intentional:
      // this is the one-time failure outcome of the setup itself.
      showToast("문서 서버에 연결하지 못했습니다.", "error");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDbError(true);
      setRoomLoaded(true);
      return undefined;
    }
  }, [code, showToast]);

  useEffect(() => {
    try {
      const unsubscribe = onValue(ref(getDb(), ".info/connected"), (snap) => {
        const isConnected = snap.val() === true;
        if (isConnected) {
          hasConnectedOnceRef.current = true;
        } else if (hasConnectedOnceRef.current) {
          showToast("연결이 끊겼습니다. 다시 연결을 시도합니다.", "error");
        }
      });
      return unsubscribe;
    } catch {
      return undefined;
    }
  }, [showToast]);

  // Arms Firebase's server-side disconnect detection for my own presence.
  useEffect(() => {
    if (!identity || !effectiveRole) return;
    try {
      return armPresence(code, effectiveRole, identity.participantId);
    } catch {
      return undefined;
    }
  }, [code, identity, effectiveRole]);

  useEffect(() => {
    if (!identity) return;
    try {
      return subscribeChat(code, setChatMessages);
    } catch {
      return undefined;
    }
  }, [code, identity]);

  useEffect(() => {
    if (!room) return;
    if (room.status === "finished" && prevStatusRef.current !== "finished") {
      const winnerName = room.winner && room.winner !== "draw" ? nameOfColor(room.winner, room) : undefined;
      const resultMessage =
        room.winner === "draw"
          ? "무승부입니다."
          : playerRole
            ? colorOf(playerRole, room) === room.winner
              ? "승리했습니다!"
              : "패배했습니다."
            : `${winnerName ?? "상대방"}님이 승리했습니다.`;
      showToast(
        resultMessage,
        "info",
        { placement: "top-center", emphasis: true },
      );
    }
    prevStatusRef.current = room.status;
  }, [room, playerRole, showToast]);

  useEffect(() => {
    if (!room || !identity) return;
    const lm = room.lastMove;

    // Skip toasting on the first observation (page load / reconnect) so we
    // don't announce a move that already happened before this player opened
    // the page — but still show the move tag itself if one exists.
    if (!lastMoveInitRef.current) {
      lastMoveInitRef.current = true;
      prevLastMoveRef.current = lm;
      prevTurnStartedAtRef.current = room.turnStartedAt;
      prevPlayingStatusRef.current = room.status;
      if (lm) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowMoveTag(true);
        if (moveTagTimerRef.current) clearTimeout(moveTagTimerRef.current);
        moveTagTimerRef.current = setTimeout(() => setShowMoveTag(false), MOVE_TAG_MS);
      }
      return;
    }

    const prev = prevLastMoveRef.current;
    const moveChanged = lm && (!prev || prev.row !== lm.row || prev.col !== lm.col);
    const turnStartedAtChanged = room.turnStartedAt !== prevTurnStartedAtRef.current;
    const wasAlreadyPlaying = prevPlayingStatusRef.current === "playing";

    if (moveChanged && lm) {
      const moverColor: Stone = room.turn === "black" ? "white" : "black";
      const myColor = playerRole ? colorOf(playerRole, room) : null;
      if (!playerRole || moverColor !== myColor) {
        const moverName = nameOfColor(moverColor, room) ?? "상대방";
        showToast(`${moverName}님이 ${columnLabel(lm.col)}${lm.row + 1} 셀을 입력했습니다.`, "info");
      }
      setShowMoveTag(true);
      if (moveTagTimerRef.current) clearTimeout(moveTagTimerRef.current);
      moveTagTimerRef.current = setTimeout(() => setShowMoveTag(false), MOVE_TAG_MS);
    } else if (turnStartedAtChanged && room.status === "playing" && wasAlreadyPlaying) {
      // turnStartedAt advanced with no new move → the timer skipped this turn.
      showToast("시간 초과로 턴이 넘어갔습니다.", "info");
    }

    prevLastMoveRef.current = lm;
    prevTurnStartedAtRef.current = room.turnStartedAt;
    prevPlayingStatusRef.current = room.status;
  }, [room, identity, playerRole, showToast]);

  useEffect(() => {
    return () => {
      if (moveTagTimerRef.current) clearTimeout(moveTagTimerRef.current);
    };
  }, []);

  // 30s turn timer: re-arms whenever a new turn actually starts, ticks every
  // second, and (from whichever client's clock gets there first) skips the
  // turn once time runs out. skipTurn no-ops if the turn already moved on.
  const turnStartedAt = room?.turnStartedAt;
  const currentTurn = room?.turn;
  const roomStatus = room?.status;

  useEffect(() => {
    if (roomStatus !== "playing" || !turnStartedAt || !currentTurn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimerSeconds(null);
      return undefined;
    }
    let interval: ReturnType<typeof setInterval> | null = null;
    function tick() {
      const elapsed = Math.floor((Date.now() - turnStartedAt!) / 1000);
      const remaining = Math.max(0, TURN_SECONDS - elapsed);
      setTimerSeconds(remaining);
      if (remaining <= 0) {
        if (interval) clearInterval(interval);
        skipTurn(code, currentTurn!).catch(() => {});
      }
    }
    tick();
    interval = setInterval(tick, 1000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [turnStartedAt, currentTurn, roomStatus, code]);

  // Opponent disconnect → grace period → forfeit in their favor.
  const opponentRole = playerRole ? opposite(playerRole) : null;
  const opponentOnline = opponentRole && room ? room.presence?.[opponentRole] : undefined;

  const disconnectedParticipantKey = JSON.stringify({
    guestId: room?.guest && room.presence?.guest === false ? room.guest.id ?? "guest" : null,
    spectatorIds: Object.entries(room?.spectators ?? {})
      .filter(([id]) => room?.presence?.spectators?.[id] === false)
      .map(([id]) => id),
  });

  useEffect(() => {
    // Skip the first observation so a room loaded with the opponent already
    // offline doesn't announce a "just now" disconnect that isn't one.
    if (!opponentPresenceInitRef.current) {
      opponentPresenceInitRef.current = true;
      prevOpponentOnlineRef.current = opponentOnline;
      return;
    }
    if (opponentOnline === false && prevOpponentOnlineRef.current !== false && roomStatus === "playing") {
      showToast("상대방과 연결이 끊겼습니다. 계속 응답이 없으면 곧 자동으로 승리 처리됩니다.", "error");
    }
    prevOpponentOnlineRef.current = opponentOnline;
  }, [opponentOnline, roomStatus, showToast]);

  useEffect(() => {
    if (!identity || !opponentRole || roomStatus !== "playing" || opponentOnline !== false) return undefined;
    const timer = setTimeout(() => {
      if (!room) return;
      if (playerRole) forfeit(code, colorOf(playerRole, room)).catch(() => {});
    }, DISCONNECT_GRACE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentOnline, roomStatus, identity, playerRole, opponentRole, code]);

  useEffect(() => {
    const disconnected = JSON.parse(disconnectedParticipantKey) as {
      guestId: string | null;
      spectatorIds: string[];
    };
    if (!disconnected.guestId && disconnected.spectatorIds.length === 0) return undefined;

    const timer = setTimeout(() => {
      const removals: Promise<void>[] = [];
      if (disconnected.guestId) {
        removals.push(leaveRoom(code, "guest", disconnected.guestId));
      }
      for (const spectatorId of disconnected.spectatorIds) {
        removals.push(leaveRoom(code, "spectator", spectatorId));
      }
      Promise.all(removals).catch(() => {});
    }, DISCONNECT_GRACE_MS);

    return () => clearTimeout(timer);
  }, [code, disconnectedParticipantKey]);

  const board = useMemo(() => room?.board ?? {}, [room]);

  async function handleJoinAsGuest() {
    const trimmed = joinName.trim();
    if (trimmed.length < 2 || trimmed.length > 8) {
      showToast("표시 이름은 2~8자로 입력해 주세요.", "error");
      return;
    }
    setJoining(true);
    try {
      const result = await joinRoom(code, trimmed);
      if (!result.ok) {
        showToast(
          result.reason === "not-found" ? "문서를 찾을 수 없습니다." : "이미 인원이 가득한 문서입니다.",
          "error",
        );
        return;
      }
      saveIdentity(code, { role: result.role, name: trimmed, participantId: result.participantId });
      setIdentity({ role: result.role, name: trimmed, participantId: result.participantId });
    } finally {
      setJoining(false);
    }
  }

  function requestStartGame() {
    if (!room || !identity) return;
    if (effectiveRole !== "host") {
      showToast("방장만 게임을 시작할 수 있습니다.", "info");
      return;
    }
    if (room.status !== "waiting") {
      showToast("게임 시작 전 대기 상태에서만 시작할 수 있습니다.", "info");
      return;
    }
    if (startingGame) return;
    if (getGameCandidates(room).length === 0) {
      showToast("게임 상대가 없습니다. 참여자를 기다려 주세요.", "info");
      return;
    }
    setStartConfirmOpen(true);
  }

  async function handleStartGame(candidateId?: string) {
    if (!room || !identity) return;
    if (effectiveRole !== "host") {
      showToast("방장만 게임을 시작할 수 있습니다.", "info");
      return;
    }
    if (room.status === "playing") {
      showToast("이미 게임이 진행 중입니다.", "info");
      return;
    }
    if (startingGame) return;

    const candidates = getGameCandidates(room);
    if (candidates.length === 0) {
      showToast("게임 상대가 없습니다. 참여자를 기다려 주세요.", "info");
      return;
    }
    const selectedId = candidateId ?? (candidates.length === 1 ? candidates[0].id : null);
    if (!selectedId) {
      setOpponentPickerOpen(true);
      return;
    }

    setStartingGame(true);
    try {
      await startGame(code, selectedId);
      setOpponentPickerOpen(false);
      showToast("게임을 시작했습니다.", "info");
    } catch {
      showToast("게임을 시작하지 못했습니다.", "error");
    } finally {
      setStartingGame(false);
    }
  }

  function handleConfirmStartGame() {
    setStartConfirmOpen(false);
    void handleStartGame();
  }

  function handleCellClick(row: number, col: number) {
    if (!room || !playerRole) return;
    if (room.status === "waiting") {
      showToast("방장이 게임을 시작할 때까지 대기 중입니다.", "info");
      return;
    }
    if (room.status === "finished") return;

    const myColor = colorOf(playerRole, room);
    if (room.turn !== myColor) {
      showToast("상대방 차례입니다.", "error");
      return;
    }
    if (getStone(board, row, col)) {
      showToast("이미 입력된 셀입니다.", "error");
      return;
    }
    if (myColor === "black" && isForbiddenBlackMove(board, row, col)) {
      showToast("이 셀에는 입력할 수 없습니다.", "error");
      return;
    }

    const newBoard = withStone(board, row, col, myColor);
    const win = checkWin(newBoard, row, col, myColor);

    placeStone(code, {
      row,
      col,
      stone: myColor,
      nextTurn: myColor === "black" ? "white" : "black",
      status: win ? "finished" : "playing",
      winner: win ? myColor : null,
    }).catch(() => showToast("입력을 저장하지 못했습니다.", "error"));
  }

  function handleSelectGame(id: string) {
    const game = GAMES.find((g) => g.id === id);
    if (!game || !game.available) {
      showToast("준비 중입니다.", "info");
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
      showToast("문서 ID를 복사했습니다.", "info");
    } catch {
      showToast("복사하지 못했습니다.", "error");
    }
  }

  async function handleRematch() {
    if (!room) return;
    try {
      await rematch(code, room.blackPlayer);
      setOpponentPickerOpen(false);
    } catch {
      showToast("새 버전을 만들지 못했습니다.", "error");
    }
  }

  function handleRestartClick() {
    if (!room) return;
    if (room.status !== "finished") {
      showToast("게임이 종료된 후 다시 시작할 수 있습니다.", "info");
      return;
    }
    handleRematch();
  }

  function handleLeaveClick() {
    if (room?.status === "playing" && playerRole) {
      setLeaveConfirmOpen(true);
      return;
    }
    leaveRoomAndNavigate();
  }

  async function leaveRoomAndNavigate() {
    try {
      if (identity && effectiveRole) {
        await leaveRoom(code, effectiveRole, identity.participantId);
      }
    } catch {
      // Leaving the page is still preferable if the cleanup write fails.
    }
    router.push("/");
  }

  async function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    if (room && playerRole) {
      const myColor = colorOf(playerRole, room);
      const opponentColor: Stone = myColor === "black" ? "white" : "black";
      try {
        await forfeit(code, opponentColor);
      } catch {
        // best effort — still leave even if the forfeit write fails
      }
    }
    await leaveRoomAndNavigate();
  }

  function handleRequestUndo() {
    if (!room || !playerRole) return;
    if (room.status !== "playing") {
      showToast("게임 진행 중에만 요청할 수 있습니다.", "info");
      return;
    }
    if (room.undoRequest || room.drawRequest) {
      showToast("이미 대기 중인 요청이 있습니다.", "info");
      return;
    }
    if (!room.lastMove) {
      showToast("무를 수 있는 수가 없습니다.", "info");
      return;
    }
    if (!canRequestUndo(room, playerRole)) {
      showToast("상대방이 둔 수를 무를 때만 요청할 수 있습니다.", "info");
      return;
    }
    requestUndo(code, playerRole).catch(() => showToast("요청을 보내지 못했습니다.", "error"));
    showToast("무르기를 요청했습니다.", "info");
  }

  function handleRequestDraw() {
    if (!room || !playerRole) return;
    if (room.status !== "playing") {
      showToast("게임 진행 중에만 요청할 수 있습니다.", "info");
      return;
    }
    if (room.undoRequest || room.drawRequest) {
      showToast("이미 대기 중인 요청이 있습니다.", "info");
      return;
    }
    requestDraw(code, playerRole).catch(() => showToast("요청을 보내지 못했습니다.", "error"));
    showToast("무승부를 요청했습니다.", "info");
  }

  async function handleAcceptUndo() {
    if (!room || !incomingUndoFrom) return;
    try {
      await acceptUndo(code, incomingUndoFrom);
    } catch {
      showToast("무르기를 처리하지 못했습니다.", "error");
    }
  }

  function handleDeclineUndo() {
    cancelUndoRequest(code).catch(() => {});
  }

  async function handleAcceptDraw() {
    try {
      await acceptDraw(code);
    } catch {
      showToast("무승부 처리에 실패했습니다.", "error");
    }
  }

  function handleDeclineDraw() {
    cancelDrawRequest(code).catch(() => {});
  }

  function handleSendChat(text: string) {
    if (!identity || !effectiveRole) return;
    sendChatMessage(code, { by: effectiveRole, name: identity.name, text }).catch(() =>
      showToast("메모를 보내지 못했습니다.", "error"),
    );
  }

  if (identity === undefined || !roomLoaded) {
    return <div className="flex-1" />;
  }

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center text-[13px] text-[#555]">
          <p>{dbError ? "문서 서버에 연결할 수 없습니다." : "문서를 찾을 수 없습니다."}</p>
          <Link href="/" className="text-[#217346] underline">
            처음 화면으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-[384px] bg-white border border-[#d0d0d0] rounded-sm shadow-sm px-5 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-[#333]">이 문서에 접근하려면 표시 이름이 필요합니다.</p>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={8}
            placeholder="예: 김철수"
            className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] outline-none focus:border-[#217346]"
          />
          <button
            onClick={handleJoinAsGuest}
            disabled={joining}
            className="bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-60 text-white text-[13px] rounded-sm py-2"
          >
            문서 열기
          </button>
        </div>
      </div>
    );
  }

  const hostColor = colorOf("host", room);
  const guestColor: Stone = hostColor === "black" ? "white" : "black";
  const hostIsTurn = room.status === "playing" && room.turn === hostColor;
  const guestIsTurn = room.status === "playing" && room.turn === guestColor;

  const lastMoverColor: Stone | null = room.lastMove ? (room.turn === "black" ? "white" : "black") : null;
  const lastMoverName = lastMoverColor ? nameOfColor(lastMoverColor, room) : undefined;

  const myColor = playerRole ? colorOf(playerRole, room) : null;
  const cellsDisabled = !playerRole || room.status !== "playing" || room.turn !== myColor;

  const avatars: ChromeAvatar[] = [
    { id: room.host.id ?? "host", name: room.host.name, color: "#7b3fe4", isTurn: hostIsTurn, online: room.presence?.host !== false },
    ...(room.guest
      ? [{ id: room.guest.id ?? "guest", name: room.guest.name, color: "#e4693f", isTurn: guestIsTurn, online: room.presence?.guest !== false }]
      : []),
  ];

  const observerAvatars: ChromeAvatar[] = Object.entries(room.spectators ?? {}).map(([id, spectator]) => ({
    id,
    name: spectator.name,
    color: "#777",
    isTurn: false,
    online: room.presence?.spectators?.[id] !== false,
  }));

  const incomingUndoFrom: PlayerRole | null =
    playerRole && room.undoRequest && room.undoRequest !== playerRole ? room.undoRequest : null;
  const incomingDrawFrom: PlayerRole | null =
    playerRole && room.drawRequest && room.drawRequest !== playerRole ? room.drawRequest : null;

  const canStartGame = room.status === "waiting" && effectiveRole === "host";

  function centerGridOnMount(el: HTMLDivElement | null) {
    if (!el || centeredOnceRef.current) return;
    centeredOnceRef.current = true;
    const centerCol = Math.floor(BOARD_SIZE / 2);
    const centerRow = Math.floor(BOARD_SIZE / 2);
    const targetLeft = HEADER_W + centerCol * CELL_W - el.clientWidth / 2 + CELL_W / 2;
    const targetTop = CELL_H + centerRow * CELL_H - el.clientHeight / 2 + CELL_H / 2;
    el.scrollTo({ left: Math.max(0, targetLeft), top: Math.max(0, targetTop) });
  }

  return (
    <>
      <ExcelChrome
        fileName="25-26_업무현황"
        avatars={avatars}
        participants={{ players: avatars, observers: observerAvatars }}
        statusLabel={room.status === "playing" ? "편집 중" : "대기 중"}
        onStatusClick={canStartGame ? requestStartGame : undefined}
        onShare={handleCopyCode}
        shareCode={code}
        games={GAMES}
        activeGameId="omok"
        onSelectGame={handleSelectGame}
        onRematch={room.status === "finished" && effectiveRole === "host" ? handleRematch : undefined}
        rematchLabel="새 버전으로 계속"
        onStartGame={canStartGame ? requestStartGame : undefined}
        onRestart={room.status === "finished" && effectiveRole === "host" ? handleRestartClick : undefined}
        onLeave={handleLeaveClick}
        timerSeconds={timerSeconds}
        onOpenChat={() => setChatOpen(toggleChatOpen)}
        onRequestUndo={playerRole ? handleRequestUndo : undefined}
        onRequestDraw={playerRole ? handleRequestDraw : undefined}
      >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* grid */}
        <div className="h-full overflow-auto" ref={centerGridOnMount}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${HEADER_W}px repeat(${BOARD_SIZE}, ${CELL_W}px)`,
            }}
          >
            <div
              className="sticky top-0 left-0 z-30 bg-[#f3f3f3] border border-[#e0e0e0]"
              style={{ width: HEADER_W, height: CELL_H }}
            />
            {COLS.map((c) => (
              <div
                key={`h-${c}`}
                className="sticky top-0 z-20 bg-[#f3f3f3] border border-[#e0e0e0] flex items-center justify-center text-[10px] text-[#666]"
                style={{ width: CELL_W, height: CELL_H }}
              >
                {columnLabel(c)}
              </div>
            ))}

            {ROWS.map((r) => (
              <FragmentRow
                key={`row-${r}`}
                row={r}
                board={board}
                lastMove={room.lastMove}
                lastMoverName={lastMoverName}
                showMoveTag={showMoveTag}
                disabled={cellsDisabled}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>

        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          myRole={effectiveRole ?? identity.role}
          onSend={handleSendChat}
        />
      </div>
      </ExcelChrome>

      <StartGameConfirmDialog
        open={startConfirmOpen}
        onConfirm={handleConfirmStartGame}
        onCancel={() => setStartConfirmOpen(false)}
      />

      {opponentPickerOpen && effectiveRole === "host" && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-sm shadow-lg w-[384px] px-5 py-4">
            <p className="text-[13px] font-semibold text-[#333]">게임 상대 선택</p>
            <p className="text-[11px] text-[#666] mt-1">이번 게임에서 대국할 참여자를 선택하세요.</p>
            <div className="flex flex-col gap-2 mt-4">
              {getGameCandidates(room).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleStartGame(candidate.id)}
                  disabled={startingGame}
                  className="flex items-center justify-between border border-[#c8c8c8] rounded-sm px-3 py-2 text-left text-[12px] hover:bg-[#f0f7f3] disabled:opacity-60"
                >
                  <span>{candidate.name}</span>
                  <span className="text-[10px] text-[#777]">{candidate.role === "guest" ? "참여자" : "옵저버"}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setOpponentPickerOpen(false)}
                className="text-[12px] px-3 py-1.5 rounded-sm border border-[#c8c8c8] hover:bg-[#f5f5f5]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingUndoFrom && (
        <div className="fixed top-16 right-3 z-[95] bg-white border border-[#d0d0d0] rounded-sm shadow-md px-3 py-2.5 w-72 text-[12px]">
          <p className="text-[#333]">{nameOfRole(incomingUndoFrom, room) ?? "상대방"}님이 한 수 무르기를 요청했습니다.</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleDeclineUndo}
              className="px-2.5 py-1 rounded-sm border border-[#c8c8c8] hover:bg-[#f5f5f5]"
            >
              거절
            </button>
            <button
              onClick={handleAcceptUndo}
              className="px-2.5 py-1 rounded-sm bg-[#217346] hover:bg-[#1a5c38] text-white"
            >
              수락
            </button>
          </div>
        </div>
      )}

      {incomingDrawFrom && (
        <div className="fixed top-16 right-3 z-[95] bg-white border border-[#d0d0d0] rounded-sm shadow-md px-3 py-2.5 w-72 text-[12px]">
          <p className="text-[#333]">{nameOfRole(incomingDrawFrom, room) ?? "상대방"}님이 무승부를 요청했습니다.</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleDeclineDraw}
              className="px-2.5 py-1 rounded-sm border border-[#c8c8c8] hover:bg-[#f5f5f5]"
            >
              거절
            </button>
            <button
              onClick={handleAcceptDraw}
              className="px-2.5 py-1 rounded-sm bg-[#217346] hover:bg-[#1a5c38] text-white"
            >
              수락
            </button>
          </div>
        </div>
      )}

      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-sm shadow-lg w-[384px] px-5 py-4">
            <p className="text-[13px] text-[#333] leading-relaxed">
              게임이 진행 중입니다. 지금 나가시면 패배 처리됩니다. 나가시겠습니까?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLeaveConfirmOpen(false)}
                className="text-[12px] px-3 py-1.5 rounded-sm border border-[#c8c8c8] hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmLeave}
                className="text-[12px] px-3 py-1.5 rounded-sm bg-[#c0392b] hover:bg-[#a5301f] text-white"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FragmentRow({
  row,
  board,
  lastMove,
  lastMoverName,
  showMoveTag,
  disabled,
  onCellClick,
}: {
  row: number;
  board: Room["board"];
  lastMove: Room["lastMove"];
  lastMoverName: string | undefined;
  showMoveTag: boolean;
  disabled: boolean;
  onCellClick: (row: number, col: number) => void;
}) {
  return (
    <>
      <div
        className="sticky left-0 z-10 bg-[#f3f3f3] border border-[#e0e0e0] flex items-center justify-center text-[10px] text-[#666]"
        style={{ width: HEADER_W, height: CELL_H }}
      >
        {row + 1}
      </div>
      {COLS.map((col) => {
        const stone = board?.[`${row}_${col}`];
        const isLast = lastMove?.row === row && lastMove?.col === col;
        return (
          <div
            key={col}
            onClick={() => onCellClick(row, col)}
            className={`relative border border-[#e0e0e0] flex items-center justify-center text-[13px] select-none ${
              disabled ? "" : "cursor-pointer hover:bg-[#eef6f1]"
            }`}
            style={{
              width: CELL_W,
              height: CELL_H,
              boxShadow: isLast ? "inset 0 0 0 2px #e4693f" : undefined,
            }}
          >
            {isLast && showMoveTag && (
              <span className="absolute -top-[16px] left-[-1px] bg-[#e4693f] text-white text-[9px] leading-none px-1 py-[2px] rounded-t-sm rounded-br-sm whitespace-nowrap z-30 opacity-50">
                {lastMoverName}
              </span>
            )}
            {stone === "black" && <span className="text-[#111]">●</span>}
            {stone === "white" && <span className="text-[#666]">○</span>}
          </div>
        );
      })}
    </>
  );
}
