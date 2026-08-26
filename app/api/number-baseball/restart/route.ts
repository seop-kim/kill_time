import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebaseAdmin";
import { getNumberBaseballPlayers, normalizeNumberBaseballRoomCode, readNumberBaseballTransactionFailure, removeUndefined, type NumberBaseballRoomNode } from "@/lib/numberBaseballServer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "다시하기 정보를 확인할 수 없습니다." }, { status: 400 });
  }
  const roomCode = normalizeNumberBaseballRoomCode(body.roomCode);
  const actorId = typeof body.actorId === "string" ? body.actorId : "";
  if (!roomCode || !actorId) return NextResponse.json({ message: "방 코드와 방장을 확인해 주세요." }, { status: 400 });

  let failure: { message: string; status: number } | null = null;
  try {
    const result = await getAdminDatabase().ref(`rooms/${roomCode}`).transaction((current: unknown) => {
      if (!current || typeof current !== "object") {
        failure = { message: "방을 찾을 수 없습니다.", status: 404 };
        return current;
      }
      const room = current as NumberBaseballRoomNode;
      if (room.gameId !== "numberBaseball") {
        failure = { message: "숫자야구 방이 아닙니다.", status: 409 };
        return current;
      }
      if (actorId !== (room.host?.id ?? "host")) {
        failure = { message: "방장만 다시 시작할 수 있습니다.", status: 403 };
        return current;
      }
      if (room.status !== "finished") {
        failure = { message: "게임이 끝난 뒤 다시 시작할 수 있습니다.", status: 409 };
        return current;
      }
      const players = getNumberBaseballPlayers(room);
      if (players.length < 2) {
        failure = { message: "두 명 이상 남아 있어야 다시 시작할 수 있습니다.", status: 409 };
        return current;
      }
      const nextRoom = { ...room, status: "waiting", winner: null, lastMove: null };
      delete nextRoom.numberBaseballGame;
      delete nextRoom.gameStartedAt;
      delete nextRoom.turnStartedAt;
      return removeUndefined(nextRoom);
    });
    const transactionFailure = readNumberBaseballTransactionFailure(failure);
    if (transactionFailure) return NextResponse.json({ message: transactionFailure.message }, { status: transactionFailure.status });
    if (!result.committed) return NextResponse.json({ message: "다시하기 상태가 이미 변경되었습니다." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "숫자야구를 다시 시작하지 못했습니다." }, { status: 500 });
  }
}
