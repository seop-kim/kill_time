import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebaseAdmin";
import { createNumberBaseballGame } from "@/lib/numberBaseball";
import { encryptNumberBaseballAnswer } from "@/lib/numberBaseballCrypto";
import {
  getNumberBaseballPlayers,
  getNumberBaseballSecret,
  normalizeNumberBaseballRoomCode,
  readNumberBaseballTransactionFailure,
  type NumberBaseballRoomNode,
  removeUndefined,
} from "@/lib/numberBaseballServer";
import { createNumberBaseballTarget } from "@/lib/numberBaseball";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "숫자야구 시작 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  const roomCode = normalizeNumberBaseballRoomCode(body.roomCode);
  const actorId = typeof body.actorId === "string" ? body.actorId : "";
  if (!roomCode || !actorId) return NextResponse.json({ message: "방 코드와 시작자를 확인해 주세요." }, { status: 400 });

  const secret = getNumberBaseballSecret();
  if (!secret) return NextResponse.json({ message: "숫자야구 서버 암호화 설정이 없습니다." }, { status: 503 });

  const now = Date.now();
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
      const hostId = room.host?.id ?? "host";
      if (actorId !== hostId) {
        failure = { message: "방장만 숫자야구를 시작할 수 있습니다.", status: 403 };
        return current;
      }
      if (room.status !== "waiting" || room.numberBaseballGame?.status === "playing") {
        failure = { message: "대기 중인 방에서만 숫자야구를 시작할 수 있습니다.", status: 409 };
        return current;
      }
      const players = getNumberBaseballPlayers(room);
      if (players.length < 2) {
        failure = { message: "두 명 이상 참여해야 숫자야구를 시작할 수 있습니다.", status: 409 };
        return current;
      }
      if (players.length > 3) {
        failure = { message: "숫자야구는 최대 3명까지 참여할 수 있습니다.", status: 409 };
        return current;
      }

      const answer = createNumberBaseballTarget();
      const game = createNumberBaseballGame(players, encryptNumberBaseballAnswer(answer, secret), now);
      const nextRoom = {
        ...room,
        status: "playing",
        winner: null,
        lastMove: null,
        gameStartedAt: now,
        turnStartedAt: now,
        numberBaseballGame: game,
      };
      delete nextRoom.board;
      delete nextRoom.seotdaGame;
      delete nextRoom.girinGame;
      delete nextRoom.minesweeperGame;
      delete nextRoom.matchRequests;
      delete nextRoom.gamePlayers;
      return removeUndefined(nextRoom);
    });

    const transactionFailure = readNumberBaseballTransactionFailure(failure);
    if (transactionFailure) return NextResponse.json({ message: transactionFailure.message }, { status: transactionFailure.status });
    if (!result.committed) return NextResponse.json({ message: "숫자야구 시작 상태가 이미 변경되었습니다." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "숫자야구를 시작하지 못했습니다." }, { status: 500 });
  }
}
