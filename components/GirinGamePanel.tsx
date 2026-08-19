"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGirinStroke,
  GIRIN_TURN_SECONDS,
  type GirinGame,
  type GirinPoint,
  type GirinStroke,
} from "../lib/girin";
import { BOARD_SIZE } from "../lib/gomoku";

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 430;
const CELL_W = 26;
const CELL_H = 22;
const HEADER_W = 40;
const GRID_ROWS = 32;
const COLS = Array.from({ length: BOARD_SIZE }, (_, index) => index);
const ROWS = Array.from({ length: GRID_ROWS }, (_, index) => index);

function columnLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function drawStroke(context: CanvasRenderingContext2D, stroke: GirinStroke) {
  if (stroke.points.length === 0) return;
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
}

export function GirinGamePanel({
  game,
  participantId,
  onSubmitPrompt,
  onDrawStroke,
  onTimeUp,
  drawingColor = "#222",
  drawingWidth = 4,
}: {
  game: GirinGame;
  participantId: string;
  onSubmitPrompt: (prompt: string) => void;
  onDrawStroke: (stroke: GirinStroke) => void;
  onTimeUp: () => void;
  drawingColor?: string;
  drawingWidth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<GirinStroke | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [remaining, setRemaining] = useState(GIRIN_TURN_SECONDS);
  const isDrawer = game.currentParticipantId === participantId;

  useEffect(() => {
    if (game.status !== "drawing" || !game.turnStartedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemaining(GIRIN_TURN_SECONDS);
      return undefined;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    let expired = false;
    function tick() {
      const next = Math.max(0, GIRIN_TURN_SECONDS - Math.floor((Date.now() - game.turnStartedAt!) / 1000));
      setRemaining(next);
      if (next === 0 && !expired) {
        expired = true;
        onTimeUp();
        if (timer) clearInterval(timer);
      }
    }

    tick();
    if (!expired) timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [game.status, game.turnStartedAt, onTimeUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffdf7";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const stroke of Object.values(game.strokes ?? {})) drawStroke(context, stroke);
  }, [game.strokes]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): GirinPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer || game.status !== "drawing") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    currentStrokeRef.current = createGirinStroke([pointFromEvent(event)], drawingColor, drawingWidth);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    const nextPoint = pointFromEvent(event);
    const previousPoint = stroke.points[stroke.points.length - 1];
    stroke.points.push(nextPoint);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previousPoint.x, previousPoint.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke && stroke.points.length > 0) onDrawStroke(stroke);
  }

  function handlePromptSubmit(event: React.FormEvent) {
    event.preventDefault();
    const prompt = promptDraft.trim();
    if (!prompt) return;
    onSubmitPrompt(prompt);
    setPromptDraft("");
  }

  const currentParticipant = game.participants[game.currentParticipantId];
  const statusLabel = game.status === "prompting" ? "출제 준비" : game.status === "drawing" ? "그림 그리기" : "게임 결과";
  const footerMessage =
    game.status === "finished"
      ? game.winnerId
        ? game.lastRoundResult?.outcome === "stumped"
          ? `${game.participants[game.winnerId]?.name ?? "출제자"}님이 5분 동안 정답을 내주지 않아 이번 퀴즈에서 승리했습니다.`
          : `${game.participants[game.winnerId]?.name ?? "누군가"}님이 정답을 맞혀 이번 퀴즈에서 승리했습니다.`
        : "한 사이클이 끝났습니다. 승자 없이 게임이 종료되었습니다."
      : "정답은 채팅에 정확히 입력하세요. 한 사이클이 지나면 게임이 종료됩니다.";

  return (
    <div data-girin-grid="true" className="h-full overflow-auto bg-white text-[#333]">
      <div
        className="relative grid min-w-max"
        style={{
          gridTemplateColumns: `${HEADER_W}px repeat(${BOARD_SIZE}, ${CELL_W}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS + 1}, ${CELL_H}px)`,
        }}
      >
        <div className="sticky left-0 top-0 z-30 border border-[#e0e0e0] bg-[#f3f3f3]" />
        {COLS.map((column) => (
          <div
            key={`header-${column}`}
            className="sticky top-0 z-20 flex items-center justify-center border border-[#e0e0e0] bg-[#f3f3f3] text-[10px] text-[#666]"
            style={{ gridColumn: column + 2, gridRow: 1 }}
          >
            {columnLabel(column)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={`row-header-${row}`} className="contents">
            <div
              className="sticky left-0 z-10 flex items-center justify-center border border-[#e0e0e0] bg-[#f3f3f3] text-[10px] text-[#666]"
              style={{ gridColumn: 1, gridRow: row + 2 }}
            >
              {row + 1}
            </div>
            {COLS.map((column) => (
              <div
                key={`${row}-${column}`}
                className="border border-[#e0e0e0] bg-white"
                style={{ gridColumn: column + 2, gridRow: row + 2 }}
              />
            ))}
          </div>
        ))}

        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            data-girin-area="status"
            className="pointer-events-auto absolute flex items-center justify-between border border-[#b8cdbd] bg-white/90 px-3"
            style={{ left: HEADER_W + CELL_W, top: CELL_H * 2, width: CELL_W * 40, height: CELL_H * 3 }}
          >
            <div>
              <div className="text-[14px] font-semibold text-[#217346]">{statusLabel}</div>
              <div className="mt-1 text-[11px] text-[#666]">
                {game.status === "prompting"
                  ? `${currentParticipant?.name ?? "현재 출제자"}님 차례입니다.`
                  : game.status === "drawing"
                    ? isDrawer
                      ? "정답 단어를 제출하고 그림을 그려 주세요."
                      : "그림을 보고 채팅으로 정답을 맞혀 주세요."
                    : "이번 사이클의 결과가 확정되었습니다."}
              </div>
            </div>
            <span className="text-[11px] text-[#666]">{game.currentRound}라운드</span>
          </div>

          <div
            data-girin-area="timer"
            className={`pointer-events-auto absolute flex flex-col items-center justify-center border px-2 ${remaining <= 10 && game.status === "drawing" ? "border-[#d9534f] bg-[#fdecea] text-[#c0392b]" : "border-[#d8d8d8] bg-white/90 text-[#555]"}`}
            style={{ left: HEADER_W + CELL_W * 43, top: CELL_H * 2, width: CELL_W * 8, height: CELL_H * 3 }}
          >
            <span className="text-[10px] text-[#777]">남은 시간</span>
            <span className="mt-0.5 text-[18px] font-bold tabular-nums">{game.status === "drawing" ? formatTime(remaining) : "--:--"}</span>
          </div>

          <div
            data-girin-area="drawing"
            className="pointer-events-auto absolute flex items-center justify-center overflow-hidden border border-[#b8b8b8] bg-white"
            style={{ left: HEADER_W + CELL_W, top: CELL_H * 5, width: CELL_W * 30, height: CELL_H * 20 }}
          >
            {game.status === "prompting" ? (
              isDrawer ? (
                <form onSubmit={handlePromptSubmit} className="flex w-[360px] flex-col gap-3 border border-[#d0d0d0] bg-white p-5 shadow-sm">
                  <p className="text-[14px] font-semibold">정답 단어</p>
                  <p className="text-[11px] text-[#777]">그림으로 표현할 단어를 입력하세요. 최대 8자입니다.</p>
                  <input
                    autoFocus
                    value={promptDraft}
                    onChange={(event) => setPromptDraft(event.target.value)}
                    maxLength={8}
                    placeholder="예: 기린"
                    className="border border-[#c8c8c8] px-2 py-2 text-[14px] outline-none focus:border-[#217346]"
                  />
                  <button type="submit" className="bg-[#217346] px-3 py-2 text-[12px] text-white hover:bg-[#1a5c38]">
                    그림 시작
                  </button>
                </form>
              ) : (
                <p className="text-[13px] text-[#777]">{currentParticipant?.name}님 차례를 준비하고 있습니다.</p>
              )
            ) : (
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`block h-full w-full bg-[#fffdf7] ${isDrawer && game.status === "drawing" ? "cursor-crosshair" : "cursor-default"}`}
                style={{ touchAction: "none" }}
              />
            )}
          </div>

          <div
            data-girin-area="drawer"
            className="pointer-events-auto absolute flex flex-col gap-2 border border-[#d0d0d0] bg-white/90 px-3 py-2"
            style={{ left: HEADER_W + CELL_W * 33, top: CELL_H * 5, width: CELL_W * 18, height: CELL_H * 20 }}
          >
            <div className="border-b border-[#e5e5e5] pb-1 text-[12px] font-semibold">현재 출제자</div>
            <div className="border border-[#e0e0e0] px-2 py-1.5 text-[11px]">
              {currentParticipant?.name ?? "없음"} <span className="text-[10px] text-[#777]">({currentParticipant?.order ?? "-"}번)</span>
            </div>
            <div className="mt-auto border-t border-[#e5e5e5] pt-2 text-[10px] text-[#777]">
              {game.status === "drawing" ? (isDrawer ? "현재 출제자입니다." : "정답을 채팅으로 보내 주세요.") : "순서대로 한 명씩 출제합니다."}
            </div>
          </div>

          <div
            data-girin-area="footer"
            className={`pointer-events-auto absolute flex items-center border px-3 text-[11px] ${game.status === "finished" ? "border-[#c8e6d0] bg-[#effaf2] text-[#245b35]" : "border-[#d0d0d0] bg-white/90 text-[#666]"}`}
            style={{ left: HEADER_W + CELL_W, top: CELL_H * 27, width: CELL_W * 50, height: CELL_H * 4 }}
          >
            {footerMessage}
          </div>
        </div>
      </div>
    </div>
  );
}
