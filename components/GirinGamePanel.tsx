"use client";

import { useEffect, useRef, useState } from "react";
import { GIRIN_TURN_SECONDS, type GirinGame, type GirinPoint, type GirinStroke } from "../lib/girin";

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 430;

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
}: {
  game: GirinGame;
  participantId: string;
  onSubmitPrompt: (prompt: string) => void;
  onDrawStroke: (stroke: GirinStroke) => void;
  onTimeUp: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<GirinStroke | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [remaining, setRemaining] = useState(GIRIN_TURN_SECONDS);
  const isDrawer = game.currentParticipantId === participantId;
  const orderedParticipants = Object.values(game.participants).sort((a, b) => a.order - b.order);

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
    currentStrokeRef.current = { points: [pointFromEvent(event)], color: "#222", width: 4 };
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

  return (
    <div className="h-full overflow-auto bg-[#f8f8f8] px-5 py-4 text-[#333]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">내가 그린 기린 그림</h2>
          <p className="mt-1 text-[11px] text-[#777]">정답은 채팅에 정확히 입력하세요. 한 사이클이 지나면 게임이 종료됩니다.</p>
        </div>
        {game.status === "drawing" && (
          <div className={`rounded-sm px-3 py-1.5 text-[16px] font-bold tabular-nums ${remaining <= 10 ? "bg-[#fdecea] text-[#c0392b]" : "bg-white text-[#555]"}`}>
            {formatTime(remaining)}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1.5">
        {orderedParticipants.map((participant) => (
          <div
            key={participant.id}
            className={`rounded-sm border px-2 py-1 text-[11px] ${participant.id === game.currentParticipantId ? "border-[#217346] bg-[#eaf5ed] font-semibold" : "border-[#d8d8d8] bg-white"}`}
          >
            {participant.order}번 {participant.name}
          </div>
        ))}
      </div>

      {game.status === "prompting" && (
        <div className="mt-5 flex min-h-[360px] items-center justify-center rounded-sm border border-dashed border-[#c8c8c8] bg-white">
          {isDrawer ? (
            <form onSubmit={handlePromptSubmit} className="flex w-[360px] flex-col gap-3 rounded-sm border border-[#d0d0d0] bg-white p-5 shadow-sm">
              <p className="text-[14px] font-semibold">문제 입력</p>
              <p className="text-[11px] text-[#777]">다른 사람에게 보여줄 그림의 정답을 입력합니다. 최대 8자입니다.</p>
              <input
                autoFocus
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                maxLength={8}
                placeholder="예: 기린"
                className="rounded-sm border border-[#c8c8c8] px-2 py-2 text-[14px] outline-none focus:border-[#217346]"
              />
              <button type="submit" className="rounded-sm bg-[#217346] px-3 py-2 text-[12px] text-white hover:bg-[#1a5c38]">
                문제 제출 후 그림 그리기
              </button>
            </form>
          ) : (
            <p className="text-[13px] text-[#777]">{game.participants[game.currentParticipantId]?.name}님이 문제를 준비하고 있습니다.</p>
          )}
        </div>
      )}

      {(game.status === "drawing" || game.status === "finished") && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold">{game.status === "finished" ? "게임 결과" : "그림 그리기"}</span>
            {game.status === "drawing" && <span className="text-[11px] text-[#777]">{isDrawer ? "그림을 그려 주세요." : "그림을 보고 채팅으로 정답을 맞혀 주세요."}</span>}
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`block border border-[#c8c8c8] bg-[#fffdf7] ${isDrawer && game.status === "drawing" ? "cursor-crosshair" : "cursor-default"}`}
            style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`, touchAction: "none" }}
          />
          {game.status === "finished" && (
            <div className="mt-3 rounded-sm border border-[#c8e6d0] bg-[#effaf2] px-3 py-2 text-[13px]">
              {game.winnerId
                ? game.lastRoundResult?.outcome === "stumped"
                  ? `${game.participants[game.winnerId]?.name ?? "출제자"}님이 5분 동안 정답을 내주지 않아 이번 퀴즈에서 승리했습니다.`
                  : `${game.participants[game.winnerId]?.name ?? "누군가"}님이 정답을 맞혀 이번 퀴즈에서 승리했습니다.`
                : "한 사이클이 끝났습니다. 승자 없이 게임이 종료되었습니다."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
