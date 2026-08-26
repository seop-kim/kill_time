import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebaseAdmin";
import { advanceNumberBaseballTurn, type NumberBaseballGame } from "@/lib/numberBaseball";
import { getNumberBaseballPlayers, normalizeNumberBaseballRoomCode, readNumberBaseballTransactionFailure, removeUndefined, type NumberBaseballRoomNode } from "@/lib/numberBaseballServer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "시간초과 정보를 확인할 수 없습니다." }, { status: 400 });
  }
  const roomCode = normalizeNumberBaseballRoomCode(body.roomCode);
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  if (!roomCode || !playerId) return NextResponse.json({ message: "방 코드와 참여자를 확인해 주세요." }, { status: 400 });

  const now = Date.now();
  let failure: { message: string; status: number } | null = null;
  try {
    const result = await getAdminDatabase().ref(`rooms/${roomCode}`).transaction((current: unknown) => {
      if (!current || typeof current !== "object") {
        failure = { message: "방을 찾을 수 없습니다.", status: 404 };
        return current;
      }
      const room = current as NumberBaseballRoomNode;
      const game = room.numberBaseballGame as NumberBaseballGame | undefined;
      if (room.gameId !== "numberBaseball" || room.status !== "playing" || !game || game.status !== "playing") {
        failure = { message: "진행 중인 숫자야구가 없습니다.", status: 409 };
        return current;
      }
      if (!getNumberBaseballPlayers(room).some((player) => player.id === playerId)) {
        failure = { message: "현재 방의 참여자가 아닙니다.", status: 403 };
        return current;
      }
      if (game.currentPlayerId !== playerId) {
        failure = { message: "이미 턴이 변경되었습니다.", status: 409 };
        return current;
      }
      const nextGame = advanceNumberBaseballTurn(game, now);
      if (nextGame === game) {
        failure = { message: "아직 시간이 지나지 않았습니다.", status: 409 };
        return current;
      }
      const nextRoom = { ...room, numberBaseballGame: nextGame, status: nextGame.status === "finished" ? "finished" : "playing" };
      if (nextGame.status === "finished") delete nextRoom.turnStartedAt;
      return removeUndefined(nextRoom);
    });
    const transactionFailure = readNumberBaseballTransactionFailure(failure);
    if (transactionFailure) return NextResponse.json({ message: transactionFailure.message }, { status: transactionFailure.status });
    if (!result.committed) return NextResponse.json({ message: "턴 상태가 이미 변경되었습니다." }, { status: 409 });
    const game = result.snapshot.child("numberBaseballGame").val() as NumberBaseballGame | null;
    return NextResponse.json({ ok: true, currentPlayerId: game?.currentPlayerId, status: game?.status, finishReason: game?.finishReason });
  } catch {
    return NextResponse.json({ message: "시간초과 처리를 저장하지 못했습니다." }, { status: 500 });
  }
}
