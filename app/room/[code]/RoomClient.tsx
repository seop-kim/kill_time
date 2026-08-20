"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  getMatchParticipants,
  joinRoom,
  leaveRoom,
  normalizeRoomGameId,
  placeStone,
  rematch,
  requestDraw,
  requestUndo,
  sendChatMessage,
  skipTurn,
  subscribeChat,
  subscribeRoom,
  setRoomGame,
  transferOfflineHostInRoom,
  toggleMatchParticipation,
  DISCONNECT_GRACE_MS,
  PARTICIPANT_REMOVAL_GRACE_MS,
  TURN_SECONDS,
  type ChatMessage,
  type MatchParticipant,
  type ParticipantRole,
  type PlayerRole,
  type Room,
} from "@/lib/rooms";
import {
  addGirinPixel,
  advanceGirinRoundInRoom,
  clearGirinPixels,
  resetGirinGame,
  startGirinGame,
  submitGirinAnswerToRoom,
  submitGirinPromptToRoom,
  type GirinGame,
  type GirinPixel,
} from "@/lib/girin";
import { getOrCreateUserId, loadIdentity, saveIdentity, type StoredIdentity } from "@/lib/identity";
import {
  recordGameResult,
  recordGirinQuizResult,
  shouldAttemptStatsRecord,
  subscribeUserStats,
  type GameStats,
} from "@/lib/stats";
import { useToast } from "@/components/Toast";
import {
  ExcelChrome,
  MatchParticipationPanel,
  StartGameConfirmDialog,
  type ChromeAvatar,
  type GameTab,
} from "@/components/ExcelChrome";
import { ChatPanel } from "@/components/ChatPanel";
import { GirinGamePanel } from "@/components/GirinGamePanel";
import { WorkCoverSheet } from "@/components/WorkCoverSheet";
import { ErrorPage } from "@/components/ErrorPage";
import { toggleChatOpen } from "@/lib/chat";

const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const CELL_W = 26;
const CELL_H = 22;
const HEADER_W = 40;
const MOVE_TAG_MS = 5000;

const GAMES: GameTab[] = [
  { id: "omok", label: "Omok", available: true },
  { id: "girin", label: "girin", available: true },
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
  if (room.gamePlayers) return room.gamePlayers[role]?.name;
  return role === "host" ? room.host.name : room.guest?.name;
}

function nameOfColor(color: Stone, room: Room): string | undefined {
  return colorOf("host", room) === color ? nameOfRole("host", room) : nameOfRole("guest", room);
}

function matchesIdentity(identity: StoredIdentity, participant: MatchParticipant): boolean {
  if (participant.role === "host") return identity.role === "host" && (!identity.participantId || identity.participantId === participant.id);
  return identity.participantId === participant.id;
}

function effectiveRoleOf(identity: StoredIdentity, room: Room): ParticipantRole {
  if (room.gamePlayers) {
    if (matchesIdentity(identity, room.gamePlayers.host)) return "host";
    if (matchesIdentity(identity, room.gamePlayers.guest)) return "guest";
    return "spectator";
  }
  if (identity.role === "host" || (identity.participantId && room.host.id === identity.participantId)) return "host";
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

function participantForRole(role: PlayerRole, room: Room): MatchParticipant | null {
  if (room.gamePlayers) return room.gamePlayers[role];
  if (role === "host") return { id: room.host.id ?? "host", name: room.host.name, role: "host" };
  return room.guest ? { id: room.guest.id ?? "guest", name: room.guest.name, role: "guest" } : null;
}

function participantOnline(room: Room, participant: MatchParticipant | null): boolean | undefined {
  if (!participant) return undefined;
  if (participant.role === "host") return room.presence?.host;
  if (participant.role === "guest") return room.presence?.guest;
  return room.presence?.spectators?.[participant.id];
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
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [profileStats, setProfileStats] = useState<Record<string, GameStats>>({});
  const [drawingColor, setDrawingColor] = useState("#222222");
  const [drawingWidth, setDrawingWidth] = useState(1);
  const [drawingEraser, setDrawingEraser] = useState(false);
  const [eraserWidth, setEraserWidth] = useState(1);
  const [drawingClearVersion, setDrawingClearVersion] = useState(0);
  const [sensitiveMode, setSensitiveMode] = useState(false);

  const prevStatusRef = useRef<Room["status"] | null>(null);
  const statsAttemptedRef = useRef<string | null>(null);
  const girinQuizAttemptedRef = useRef<string | null>(null);
  const prevGirinStatusRef = useRef<GirinGame["status"] | null>(null);
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
  const activeGameId = normalizeRoomGameId(room?.gameId);

  useEffect(() => {
    // localStorage doesn't exist during SSR, so this can only run after mount.
    const loaded = loadIdentity(code);
    if (!loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdentity(null);
      return;
    }
    const userId = loaded.userId ?? getOrCreateUserId();
    const upgraded = { ...loaded, userId };
    if (loaded.userId !== userId) saveIdentity(code, upgraded);
    setIdentity(upgraded);
  }, [code]);

  useEffect(() => {
    if (!identity || identity.role === "host" || !room?.host.id || identity.participantId !== room.host.id) return;
    const promotedIdentity: StoredIdentity = { ...identity, role: "host" };
    saveIdentity(code, promotedIdentity);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentity(promotedIdentity);
  }, [code, identity, room?.host.id]);

  useEffect(() => {
    if (!identity?.userId) return undefined;
    try {
      return subscribeUserStats(identity.userId, (profile) => setProfileStats(profile.games));
    } catch {
      return undefined;
    }
  }, [identity?.userId]);

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
      const isRoomHost = identity.role === "host" || identity.participantId === room?.host.id;
      return armPresence(code, isRoomHost ? "host" : identity.role, identity.participantId);
    } catch {
      return undefined;
    }
  }, [code, identity, effectiveRole, room?.host.id]);

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
    if (room.status === "playing" && prevStatusRef.current === "waiting") {
      showToast("대진이 성사되어 게임을 시작했습니다.", "info");
    }
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
    if (room?.status !== "finished") {
      return;
    }
    if (activeGameId !== "omok") return;
    if (!room.winner || !playerRole || !identity?.userId) return;

    const gameSessionId = room.gameStartedAt ?? room.turnStartedAt ?? `${room.lastMove?.row ?? "none"}-${room.lastMove?.col ?? "none"}`;
    const resultId = `omok:${code}:${gameSessionId}`;
    if (!shouldAttemptStatsRecord(statsAttemptedRef.current, resultId)) return;

    const result =
      room.winner === "draw"
        ? "draw"
        : colorOf(playerRole, room) === room.winner
          ? "win"
          : "loss";
    statsAttemptedRef.current = resultId;
    recordGameResult(identity.userId, identity.name, "omok", result, resultId).catch(() => {
      showToast("전적을 저장하지 못했습니다.", "error");
    });
  }, [activeGameId, code, identity, playerRole, room, showToast]);

  useEffect(() => {
    const game = room?.girinGame;
    if (!game) {
      prevGirinStatusRef.current = null;
      girinQuizAttemptedRef.current = null;
      return;
    }

    if (game.status === "finished" && prevGirinStatusRef.current !== "finished") {
      const winnerName = game.winnerId ? game.participants[game.winnerId]?.name : undefined;
      const winnerMessage =
        game.finishReason === "participant_left"
          ? "참여자가 부족해 게임이 종료되었습니다."
          : game.lastRoundResult?.outcome === "stumped"
          ? `${winnerName ?? "출제자"}님이 5분 동안 정답을 내주지 않아 이번 퀴즈에서 승리했습니다.`
          : `${winnerName ?? "누군가"}님이 정답을 맞혀 이번 퀴즈에서 승리했습니다.`;
      showToast(
        game.finishReason === "participant_left" || game.winnerId
          ? winnerMessage
          : "한 사이클이 끝나 게임이 종료되었습니다.",
        "info",
        { placement: "top-center", emphasis: true },
      );
    }
    prevGirinStatusRef.current = game.status;
  }, [room?.girinGame, showToast]);

  useEffect(() => {
    const game = room?.girinGame;
    const roundResult = game?.lastRoundResult;
    if (!game || !roundResult) {
      if (!game) girinQuizAttemptedRef.current = null;
      return;
    }
    const participantId = identity?.role === "host" ? "host" : identity?.participantId;
    if (!participantId || !identity?.userId || !game.participants[participantId]) return;

    const gameSessionId = game.startedAt ?? `${code}:${Object.keys(game.participants).sort().join(",")}`;
    const resultId = `girin:quiz:${code}:${gameSessionId}:${roundResult.round}`;
    if (!shouldAttemptStatsRecord(girinQuizAttemptedRef.current, resultId)) return;

    girinQuizAttemptedRef.current = resultId;
    recordGirinQuizResult(identity.userId, identity.name, resultId, {
      totalQuizzes: 1,
      correctAnswers: roundResult.outcome === "answered" && roundResult.winnerId === participantId ? 1 : 0,
      stumped: roundResult.outcome === "stumped" && roundResult.winnerId === participantId ? 1 : 0,
    }).catch(() => {
      showToast("전적을 저장하지 못했습니다.", "error");
    });
  }, [code, identity, room?.girinGame, showToast]);

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
  const opponentOnline = opponentRole && room ? participantOnline(room, participantForRole(opponentRole, room)) : undefined;

  const disconnectedParticipantKey = JSON.stringify({
    guestId: room?.guest && room.presence?.guest === false ? room.guest.id ?? "guest" : null,
    spectatorIds: Object.entries(room?.spectators ?? {})
      .filter(([id]) => room?.presence?.spectators?.[id] === false)
      .map(([id]) => id),
  });
  const hostTransferKey = JSON.stringify({
    hostOffline: room?.presence?.host === false,
    guestId: room?.guest && room.presence?.guest !== false ? room.guest.id ?? "guest" : null,
    spectatorIds: Object.entries(room?.spectators ?? {})
      .filter(([id]) => room?.presence?.spectators?.[id] !== false)
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
    const transfer = JSON.parse(hostTransferKey) as { hostOffline: boolean };
    if (!transfer.hostOffline) return undefined;

    const timer = setTimeout(() => {
      transferOfflineHostInRoom(code).catch(() => {});
    }, PARTICIPANT_REMOVAL_GRACE_MS);

    return () => clearTimeout(timer);
  }, [code, hostTransferKey]);

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
    }, PARTICIPANT_REMOVAL_GRACE_MS);

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
      const userId = getOrCreateUserId();
      saveIdentity(code, { role: result.role, name: trimmed, participantId: result.participantId, userId });
      setIdentity({ role: result.role, name: trimmed, participantId: result.participantId, userId });
    } finally {
      setJoining(false);
    }
  }

  function requestStartGame() {
    if (!room || !identity) return;
    if (activeGameId === "girin") {
      const girinStatus = room.girinGame?.status ?? "waiting";
      if (girinStatus !== "waiting") {
        showToast("게임 시작 전 대기 상태에서만 시작할 수 있습니다.", "info");
        return;
      }
      if (identity.role !== "host") {
        showToast("방장만 게임을 시작할 수 있습니다.", "info");
        return;
      }
      if (getMatchParticipants(room).length < 2) {
        showToast("두 명 이상 참여해야 게임을 시작할 수 있습니다.", "info");
        return;
      }
      setStartConfirmOpen(true);
      return;
    }
    if (room.status !== "waiting") {
      showToast("대기 중인 방에서만 대진에 참여할 수 있습니다.", "info");
      return;
    }
    const participantId = identity.role === "host" ? room.host.id ?? "host" : identity.participantId;
    if (!participantId || !getMatchParticipants(room).some((participant) => participant.id === participantId)) {
      showToast("현재 방 참여 정보를 확인할 수 없습니다.", "error");
      return;
    }
    if (room.matchRequests?.[participantId]) {
      toggleMatchParticipation(code, room.matchRequests[participantId], false).catch(() =>
        showToast("대진 참여를 취소하지 못했습니다.", "error"),
      );
      return;
    }
    setStartConfirmOpen(true);
  }

  async function handleConfirmStartGame() {
    setStartConfirmOpen(false);
    if (!room || !identity) return;
    if (activeGameId === "girin") {
      if (identity.role !== "host") return;
      try {
        await startGirinGame(code, getMatchParticipants(room));
        showToast("게임을 시작했습니다. 순번이 무작위로 정해졌습니다.", "info");
      } catch {
        showToast("게임을 시작하지 못했습니다.", "error");
      }
      return;
    }
    const participantId = identity.role === "host" ? room.host.id ?? "host" : identity.participantId;
    const participant = participantId
      ? getMatchParticipants(room).find((candidate) => candidate.id === participantId)
      : undefined;
    if (!participant) {
      showToast("현재 방 참여 정보를 확인할 수 없습니다.", "error");
      return;
    }
    try {
      await toggleMatchParticipation(code, participant, true);
      showToast("대진 참여 신청을 보냈습니다. 두 명이 모이면 게임이 시작됩니다.", "info");
    } catch {
      showToast("대진 참여 신청을 보내지 못했습니다.", "error");
    }
  }

  function handleCellClick(row: number, col: number) {
    if (!room || !playerRole) return;
    if (room.status === "waiting") {
      showToast("대진 참여자 두 명이 모일 때까지 대기 중입니다.", "info");
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
      return;
    }
    if (identity?.role !== "host") {
      showToast("방장만 게임을 변경할 수 있습니다.", "info");
      return;
    }
    const nextGameId = normalizeRoomGameId(id);
    if (nextGameId === activeGameId) return;
    setRoomGame(code, nextGameId).catch(() => showToast("게임을 변경하지 못했습니다.", "error"));
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
    } catch {
      showToast("새 버전을 만들지 못했습니다.", "error");
    }
  }

  function handleRestartClick() {
    if (!room) return;
    if (activeGameId === "girin") {
      if (room.girinGame?.status !== "finished") {
        showToast("게임이 종료된 후 다시 시작할 수 있습니다.", "info");
        return;
      }
      resetGirinGame(code).catch(() => showToast("게임을 다시 시작하지 못했습니다.", "error"));
      return;
    }
    if (room.status !== "finished") {
      showToast("게임이 종료된 후 다시 시작할 수 있습니다.", "info");
      return;
    }
    handleRematch();
  }

  function handleLeaveClick() {
    if (activeGameId === "omok" && room?.status === "playing" && playerRole) {
      setLeaveConfirmOpen(true);
      return;
    }
    leaveRoomAndNavigate();
  }

  async function leaveRoomAndNavigate() {
    try {
      if (identity) {
        await leaveRoom(code, identity.role, identity.participantId);
      }
    } catch {
      // Leaving the page is still preferable if the cleanup write fails.
    }
    router.push("/");
  }

  async function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    if (activeGameId === "omok" && room && playerRole) {
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
    if (activeGameId !== "omok") return;
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
    if (activeGameId !== "omok") return;
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
    const message = sendChatMessage(code, {
      by: effectiveRole,
      participantId: identity.userId ?? identity.participantId,
      name: identity.name,
      text,
    });
    message
      .then(() => {
        const girin = room?.girinGame;
        const participantId = identity.role === "host" ? room?.host.id ?? "host" : identity.participantId;
        if (activeGameId === "girin" && girin?.status === "drawing" && participantId) {
          return submitGirinAnswerToRoom(code, participantId, text);
        }
        return undefined;
      })
      .catch(() => showToast("메모를 보내지 못했습니다.", "error"));
  }

  if (identity === undefined || !roomLoaded) {
    return <div className="flex-1" />;
  }

  if (!room) {
    return dbError ? (
      <ErrorPage
        title="문서 서버 오류가 발생했습니다."
        message="문서를 불러오지 못했습니다. 잠시 후 처음 화면에서 다시 시도해 주세요."
      />
    ) : (
      <ErrorPage
        title="문서를 찾을 수 없습니다."
        message="존재하지 않거나 이미 삭제된 문서입니다."
      />
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

  const hostParticipant = participantForRole("host", room)!;
  const guestParticipant = participantForRole("guest", room);
  const roomHostId = room.host.id ?? "host";
  const avatars: ChromeAvatar[] = [
    { id: hostParticipant.id, name: hostParticipant.name, color: "#7b3fe4", isTurn: hostIsTurn, isHost: hostParticipant.id === roomHostId, online: participantOnline(room, hostParticipant) !== false },
    ...(guestParticipant
      ? [{ id: guestParticipant.id, name: guestParticipant.name, color: "#e4693f", isTurn: guestIsTurn, isHost: guestParticipant.id === roomHostId, online: participantOnline(room, guestParticipant) !== false }]
      : []),
  ];

  const matchParticipants = getMatchParticipants(room);
  const activePlayerIds = new Set(avatars.map((avatar) => avatar.id));
  const observerAvatars: ChromeAvatar[] = matchParticipants
    .filter((participant) => !activePlayerIds.has(participant.id))
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      color: "#777",
      isTurn: false,
      isHost: false,
      online: participantOnline(room, participant) !== false,
    }));
  const myMatchParticipantId = identity.role === "host" ? room.host.id ?? "host" : identity.participantId ?? "";
  const matchRequests = Object.keys(room.matchRequests ?? {}).filter((id) =>
    matchParticipants.some((participant) => participant.id === id),
  );

  const profileAvatar: ChromeAvatar =
    effectiveRole === "guest" && avatars[1]
      ? {
          id: avatars[1].id,
          name: avatars[1].name,
          color: "#e4693f",
          isTurn: guestIsTurn,
          online: avatars[1].online,
        }
      : effectiveRole === "spectator"
        ? {
            id: identity.userId ?? identity.participantId,
            name: identity.name,
            color: "#777",
            isTurn: false,
            online: identity.participantId ? room.presence?.spectators?.[identity.participantId] !== false : true,
          }
        : avatars[0];

  const incomingUndoFrom: PlayerRole | null =
    playerRole && room.undoRequest && room.undoRequest !== playerRole ? room.undoRequest : null;
  const incomingDrawFrom: PlayerRole | null =
    playerRole && room.drawRequest && room.drawRequest !== playerRole ? room.drawRequest : null;

  const girinStatus = room.girinGame?.status ?? "waiting";
  const currentGameStatus = activeGameId === "girin" ? girinStatus : room.status;
  const currentStatusLabel =
    currentGameStatus === "playing"
      ? "편집 중"
      : currentGameStatus === "drawing"
        ? "편집 중"
        : currentGameStatus === "prompting"
          ? "문제 입력 중"
          : currentGameStatus === "finished"
            ? "종료"
            : "대기 중";
  const canStartGame =
    activeGameId === "girin"
      ? girinStatus === "waiting" && identity.role === "host"
      : room.status === "waiting";

  function centerGridOnMount(el: HTMLDivElement | null) {
    if (!el || centeredOnceRef.current) return;
    centeredOnceRef.current = true;
    const centerCol = Math.floor(BOARD_SIZE / 2);
    const centerRow = Math.floor(BOARD_SIZE / 2);
    const targetLeft = HEADER_W + centerCol * CELL_W - el.clientWidth / 2 + CELL_W / 2;
    const targetTop = CELL_H + centerRow * CELL_H - el.clientHeight / 2 + CELL_H / 2;
    el.scrollTo({ left: Math.max(0, targetLeft), top: Math.max(0, targetTop) });
  }

  function handleClearGirinDrawing() {
    if (!room || !identity) {
      showToast("현재 방 정보를 확인할 수 없습니다.", "error");
      return;
    }
    const game = room.girinGame;
    const participantId = identity.role === "host" ? room.host.id ?? "host" : identity.participantId;
    if (activeGameId !== "girin" || !game || game.status !== "drawing" || !participantId || game.currentParticipantId !== participantId) {
      showToast("현재 출제자만 전체 지우기를 사용할 수 있습니다.", "error");
      return;
    }
    setDrawingClearVersion((version) => version + 1);
    clearGirinPixels(code).catch(() => showToast("그림을 전체 지우지 못했습니다.", "error"));
  }

  function handleSensitivityToggle() {
    setSensitiveMode((enabled) => !enabled);
    setChatOpen(false);
  }

  return (
    <>
      <ExcelChrome
        fileName="25-26_업무현황"
        avatars={avatars}
        profileAvatar={profileAvatar}
        profileStats={profileStats}
        participants={{ players: avatars, observers: observerAvatars }}
        statusLabel={currentStatusLabel}
        onStatusClick={canStartGame ? requestStartGame : undefined}
        onShare={handleCopyCode}
        shareCode={code}
        games={GAMES}
        activeGameId={activeGameId}
        onSelectGame={handleSelectGame}
        onRematch={currentGameStatus === "finished" && identity.role === "host" ? (activeGameId === "girin" ? handleRestartClick : handleRematch) : undefined}
        rematchLabel="새 버전으로 계속"
        onStartGame={canStartGame ? requestStartGame : undefined}
        startActionLabel={activeGameId === "girin" ? "게임 시작" : "대진 참여"}
        onRestart={currentGameStatus === "finished" && identity.role === "host" ? handleRestartClick : undefined}
        onLeave={handleLeaveClick}
        timerSeconds={activeGameId === "omok" ? timerSeconds : null}
        onOpenChat={() => setChatOpen(toggleChatOpen)}
        onRequestUndo={activeGameId === "omok" && playerRole ? handleRequestUndo : undefined}
        onRequestDraw={activeGameId === "omok" && playerRole ? handleRequestDraw : undefined}
        sensitiveMode={sensitiveMode}
        onToggleSensitivity={handleSensitivityToggle}
        drawingColor={drawingColor}
        onDrawingColorChange={setDrawingColor}
        drawingWidth={drawingWidth}
        onDrawingWidthChange={setDrawingWidth}
        drawingEraser={drawingEraser}
        onDrawingEraserChange={setDrawingEraser}
        eraserWidth={eraserWidth}
        onEraserWidthChange={setEraserWidth}
        onClearDrawing={activeGameId === "girin" ? handleClearGirinDrawing : undefined}
      >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {sensitiveMode ? (
          <WorkCoverSheet />
        ) : (
          <>
        {activeGameId === "omok" && room.status === "waiting" && (
          <div className="absolute right-3 top-3 z-40">
            <MatchParticipationPanel
              participants={matchParticipants}
              requests={matchRequests}
              myParticipantId={myMatchParticipantId}
              onToggle={(participate) => {
                if (participate) {
                  requestStartGame();
                  return;
                }
                const requested = room.matchRequests?.[myMatchParticipantId];
                if (requested) {
                  toggleMatchParticipation(code, requested, false).catch(() =>
                    showToast("대진 참여를 취소하지 못했습니다.", "error"),
                  );
                }
              }}
            />
          </div>
        )}
        {activeGameId === "girin" ? (
          room.girinGame ? (
            <GirinGamePanel
              game={room.girinGame}
              participantId={identity.role === "host" ? room.host.id ?? "host" : identity.participantId ?? ""}
              drawingColor={drawingColor}
              drawingWidth={drawingWidth}
              drawingEraser={drawingEraser}
              eraserWidth={eraserWidth}
              clearVersion={drawingClearVersion}
              onSubmitPrompt={(prompt) => {
    const participantId = identity.role === "host" ? room.host.id ?? "host" : identity.participantId;
                if (!participantId) return;
                submitGirinPromptToRoom(code, participantId, prompt).catch(() =>
                  showToast("문제를 제출하지 못했습니다.", "error"),
                );
              }}
              onDrawPixel={(pixel: GirinPixel) => {
                addGirinPixel(code, pixel).catch(() => showToast("픽셀을 저장하지 못했습니다.", "error"));
              }}
              onTimeUp={() => {
                advanceGirinRoundInRoom(code).catch(() => showToast("다음 문제로 넘어가지 못했습니다.", "error"));
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#f8f8f8] text-[13px] text-[#777]">
              방장이 게임을 시작하면 순번이 무작위로 정해집니다.
            </div>
          )
        ) : (
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
        )}

        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          myRole={effectiveRole ?? identity.role}
          onSend={handleSendChat}
        />
          </>
        )}
      </div>
      </ExcelChrome>

      <StartGameConfirmDialog
        open={startConfirmOpen}
        onConfirm={handleConfirmStartGame}
        onCancel={() => setStartConfirmOpen(false)}
        title={activeGameId === "girin" ? "게임을 시작하시겠습니까?" : "대진에 참여하시겠습니까?"}
        description={
          activeGameId === "girin"
            ? "방의 모든 참여자가 게임에 참여하고, 순번이 무작위로 정해집니다."
            : "두 명이 대진에 참여하면 자동으로 게임이 시작됩니다."
        }
        confirmLabel={activeGameId === "girin" ? "시작" : "참여하기"}
      />

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
