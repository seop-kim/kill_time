"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  joinRoom,
  placeStone,
  rematch,
  subscribeRoom,
  type PlayerRole,
  type Room,
} from "@/lib/rooms";
import { loadIdentity, saveIdentity, type StoredIdentity } from "@/lib/identity";
import { useToast } from "@/components/Toast";

const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const CELL_W = 26;
const CELL_H = 22;
const HEADER_W = 40;

function colorOf(role: PlayerRole, room: Room): Stone {
  return room.blackPlayer === role ? "black" : "white";
}

function nameOfColor(color: Stone, room: Room): string | undefined {
  return colorOf("host", room) === color ? room.host.name : room.guest?.name;
}

function initials(name: string): string {
  return name.trim().slice(0, 1) || "?";
}

export default function RoomClient({ code }: { code: string }) {
  const showToast = useToast();

  const [identity, setIdentity] = useState<StoredIdentity | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  const prevStatusRef = useRef<Room["status"] | null>(null);
  const hasConnectedOnceRef = useRef(false);

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

  useEffect(() => {
    if (!room) return;
    if (room.status === "finished" && prevStatusRef.current !== "finished") {
      const winnerName = room.winner ? nameOfColor(room.winner, room) : undefined;
      showToast(`${winnerName ?? "상대방"}님이 문서를 완료했습니다.`, "info");
    }
    prevStatusRef.current = room.status;
  }, [room, showToast]);

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
      saveIdentity(code, { role: result.role, name: trimmed });
      setIdentity({ role: result.role, name: trimmed });
    } finally {
      setJoining(false);
    }
  }

  function handleCellClick(row: number, col: number) {
    if (!room || !identity) return;
    if (room.status === "waiting") {
      showToast("공동 작업자를 기다리는 중입니다.", "info");
      return;
    }
    if (room.status === "finished") return;

    const myColor = colorOf(identity.role, room);
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
        <div className="w-full max-w-sm bg-white border border-[#d0d0d0] rounded-sm shadow-sm px-5 py-4 flex flex-col gap-3">
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

  const myColor = colorOf(identity.role, room);
  const cellsDisabled = room.status !== "playing" || room.turn !== myColor;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ribbon */}
      <div className="border-b border-[#d0d0d0] px-3 pt-1.5">
        <div className="flex gap-4 text-[11px] text-[#444]">
          <span className="text-[#185abd] font-semibold border-b-2 border-[#185abd] pb-1">홈</span>
          <span className="pb-1">삽입</span>
          <span className="pb-1">페이지 레이아웃</span>
          <span className="pb-1">수식</span>
          <span className="pb-1">데이터</span>
          <span className="pb-1">검토</span>
        </div>
      </div>

      {/* toolbar */}
      <div className="border-b border-[#d0d0d0] px-3 py-1.5 flex items-center justify-between bg-gradient-to-b from-white to-[#f3f2f1]">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-5 h-5 bg-[#e9e9e9] rounded-sm" />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {room.status === "waiting" && (
            <button
              onClick={handleCopyCode}
              className="text-[11px] text-[#555] border border-[#c8c8c8] rounded-sm px-2 py-1 hover:bg-[#f0f0f0]"
            >
              문서 ID: {code} · 복사
            </button>
          )}
          <div className="flex items-center gap-1">
            <div
              title={room.host.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                background: "#7b3fe4",
                boxShadow: hostIsTurn ? "0 0 0 2px #e4693f" : undefined,
              }}
            >
              {initials(room.host.name)}
            </div>
            {room.guest && (
              <div
                title={room.guest.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  background: "#e4693f",
                  boxShadow: guestIsTurn ? "0 0 0 2px #e4693f" : undefined,
                }}
              >
                {initials(room.guest.name)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="flex-1 overflow-auto min-h-0">
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
              disabled={cellsDisabled}
              onCellClick={handleCellClick}
            />
          ))}
        </div>
      </div>

      {/* sheet tab bar */}
      <div className="border-t border-[#d0d0d0] px-3 py-1.5 flex items-center justify-between bg-[#f3f2f1]">
        <span className="bg-white border-t-2 border-[#217346] text-[11px] px-3 py-1 rounded-t-sm">
          Sheet1
        </span>
        {room.status === "finished" && (
          <button
            onClick={handleRematch}
            className="text-[11px] bg-[#217346] hover:bg-[#1a5c38] text-white rounded-sm px-3 py-1"
          >
            새 버전으로 계속
          </button>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  board,
  lastMove,
  lastMoverName,
  disabled,
  onCellClick,
}: {
  row: number;
  board: Room["board"];
  lastMove: Room["lastMove"];
  lastMoverName: string | undefined;
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
            {isLast && (
              <span className="absolute -top-[16px] left-[-1px] bg-[#e4693f] text-white text-[9px] leading-none px-1 py-[2px] rounded-t-sm rounded-br-sm whitespace-nowrap z-30">
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
