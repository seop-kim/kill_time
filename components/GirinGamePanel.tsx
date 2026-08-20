"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGirinPixel,
  createGirinBrushPixels,
  createGirinLinePixels,
  GIRIN_PIXEL_COLUMNS,
  GIRIN_PIXEL_ROWS,
  GIRIN_PIXEL_SIZE,
  GIRIN_TURN_SECONDS,
  girinPixelKey,
  type GirinGame,
  type GirinPixel,
} from "../lib/girin";

const BOARD_WIDTH = GIRIN_PIXEL_COLUMNS * GIRIN_PIXEL_SIZE;
const BOARD_HEIGHT = GIRIN_PIXEL_ROWS * GIRIN_PIXEL_SIZE;
const PIXEL_GRID_COLOR = "#d9d9d9";

export function GirinGamePanel({
  game,
  participantId,
  onSubmitPrompt,
  onDrawPixel,
  onTimeUp,
  drawingColor = "#222",
  drawingWidth = 1,
  drawingEraser = false,
  eraserWidth = 1,
  clearVersion = 0,
}: {
  game: GirinGame;
  participantId: string;
  onSubmitPrompt: (prompt: string) => void;
  onDrawPixel: (pixel: GirinPixel) => void;
  onTimeUp: () => void;
  drawingColor?: string;
  drawingWidth?: number;
  drawingEraser?: boolean;
  eraserWidth?: number;
  clearVersion?: number;
}) {
  const paintingRef = useRef(false);
  const lastPaintedPixelRef = useRef<{ row: number; col: number } | null>(null);
  const paintedPixelKeysRef = useRef<Set<string>>(new Set());
  const [promptDraft, setPromptDraft] = useState("");
  const [localPixels, setLocalPixels] = useState<Record<string, GirinPixel>>({});
  const isDrawer = game.currentParticipantId === participantId;
  const canDraw = isDrawer && game.status === "drawing";
  const pixelsCleared = game.pixels == null;

  useEffect(() => {
    if (game.status !== "drawing" || !game.turnStartedAt) {
      return undefined;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    let expired = false;
    function tick() {
      const next = Math.max(0, GIRIN_TURN_SECONDS - Math.floor((Date.now() - game.turnStartedAt!) / 1000));
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
    // A new prompt or round starts with an empty board. The Firebase update
    // arrives separately, so clear the optimistic pixels immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPixels({});
    lastPaintedPixelRef.current = null;
    paintedPixelKeysRef.current.clear();
  }, [clearVersion, game.currentRound, game.status, game.prompt, pixelsCleared]);

  function pixelFromEvent(event: React.PointerEvent<HTMLDivElement>): GirinPixel | null {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * GIRIN_PIXEL_COLUMNS);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * GIRIN_PIXEL_ROWS);
    if (row < 0 || row >= GIRIN_PIXEL_ROWS || col < 0 || col >= GIRIN_PIXEL_COLUMNS) return null;
    return createGirinPixel(row, col, drawingColor);
  }

  function paintPixel(pixel: GirinPixel) {
    if (!canDraw) return;
    const brushSize = drawingEraser ? eraserWidth : drawingWidth;
    const linePixels = lastPaintedPixelRef.current
      ? createGirinLinePixels(
          lastPaintedPixelRef.current.row,
          lastPaintedPixelRef.current.col,
          pixel.row,
          pixel.col,
        )
      : [{ row: pixel.row, col: pixel.col }];

    for (const linePixel of linePixels) {
      const brushPixels = createGirinBrushPixels(linePixel.row, linePixel.col, brushSize, drawingEraser ? null : drawingColor);
      for (const nextPixel of brushPixels) {
        const key = girinPixelKey(nextPixel.row, nextPixel.col);
        if (paintedPixelKeysRef.current.has(key)) continue;
        paintedPixelKeysRef.current.add(key);
        setLocalPixels((current) => ({ ...current, [key]: nextPixel }));
        onDrawPixel(nextPixel);
      }
    }
    lastPaintedPixelRef.current = { row: pixel.row, col: pixel.col };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintingRef.current = true;
    lastPaintedPixelRef.current = null;
    paintedPixelKeysRef.current.clear();
    const pixel = pixelFromEvent(event);
    if (pixel) paintPixel(pixel);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!paintingRef.current) return;
    const pixel = pixelFromEvent(event);
    if (pixel) paintPixel(pixel);
  }

  function stopPainting(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    paintingRef.current = false;
    lastPaintedPixelRef.current = null;
    paintedPixelKeysRef.current.clear();
  }

  function handlePromptSubmit(event: React.FormEvent) {
    event.preventDefault();
    const prompt = promptDraft.trim();
    if (!prompt) return;
    onSubmitPrompt(prompt);
    setPromptDraft("");
  }

  const pixels = { ...(game.pixels ?? {}), ...localPixels };

  return (
    <div data-girin-grid="true" className="h-full overflow-auto bg-[#f3f3f3] text-[#333]">
      <div className="relative min-w-max" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
        <div
          data-girin-area="drawing"
          className="relative overflow-hidden border border-[#b8b8b8] bg-[#fffdf7]"
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
        >
          <div
            data-girin-pixel-board="true"
            data-girin-pixel-count={`${GIRIN_PIXEL_COLUMNS}x${GIRIN_PIXEL_ROWS}`}
            aria-label="픽셀 그림판"
            className={`absolute inset-0 ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
            style={{
              touchAction: "none",
              backgroundImage: `linear-gradient(to right, ${PIXEL_GRID_COLOR} 1px, transparent 1px), linear-gradient(to bottom, ${PIXEL_GRID_COLOR} 1px, transparent 1px)`,
              backgroundSize: `${GIRIN_PIXEL_SIZE}px ${GIRIN_PIXEL_SIZE}px`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopPainting}
            onPointerCancel={stopPainting}
          >
            {Object.values(pixels).map((pixel) => {
              if (pixel.color === null) return null;
              const key = girinPixelKey(pixel.row, pixel.col);
              return (
                <div
                  key={key}
                  data-girin-pixel-key={key}
                  className="pointer-events-none absolute"
                  style={{
                    left: pixel.col * GIRIN_PIXEL_SIZE + 1,
                    top: pixel.row * GIRIN_PIXEL_SIZE + 1,
                    width: GIRIN_PIXEL_SIZE - 1,
                    height: GIRIN_PIXEL_SIZE - 1,
                    backgroundColor: pixel.color ?? "transparent",
                  }}
                />
              );
            })}
          </div>

          {game.status === "prompting" && isDrawer && (
            <form
              onSubmit={handlePromptSubmit}
              className="absolute left-1/2 top-1/2 z-10 flex w-[360px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 border border-[#d0d0d0] bg-white p-5 shadow-sm"
            >
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
          )}
        </div>
      </div>
    </div>
  );
}
