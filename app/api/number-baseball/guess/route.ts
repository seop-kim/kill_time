import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebaseAdmin";
import {
  applyNumberBaseballTurn,
  evaluateNumberBaseballGuess,
  normalizeNumberBaseballGuess,
  type NumberBaseballGame,
} from "@/lib/numberBaseball";
import { decryptNumberBaseballAnswer } from "@/lib/numberBaseballCrypto";
import {
  getNumberBaseballPlayers,
  getNumberBaseballSecret,
  normalizeNumberBaseballRoomCode,
  readNumberBaseballTransactionFailure,
  type NumberBaseballRoomNode,
  removeUndefined,
} from "@/lib/numberBaseballServer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "입력 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  const roomCode = normalizeNumberBaseballRoomCode(body.roomCode);
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const guess = normalizeNumberBaseballGuess(body.guess);
  if (!roomCode || !playerId || !guess) {
    return NextResponse.json({ message: "서로 다른 숫자 3개를 입력해 주세요." }, { status: 400 });
  }

  const secret = getNumberBaseballSecret();
  if (!secret) return NextResponse.json({ message: "숫자야구 서버 암호화 설정이 없습니다." }, { status: 503 });

  const now = Date.now();
  let failure: { message: string; status: number } | null = null;
  let feedback: { strikes: number; balls: number; outs: number } | null = null;
  try {
    const result = await getAdminDatabase().ref(`rooms/${roomCode}`).transaction((current: unknown) => {
      if (!current || typeof current !== "object") {
        failure = { message: "방을 찾을 수 없습니다.", status: 404 };
        return current;
      }
      const room = current as NumberBaseballRoomNode;
      const game = room.numberBaseballGame as NumberBaseballGame | undefined;
      const players = getNumberBaseballPlayers(room);
      if (room.gameId !== "numberBaseball" || room.status !== "playing" || !game || game.status !== "playing") {
        failure = { message: "진행 중인 숫자야구가 없습니다.", status: 409 };
        return current;
      }
      if (!players.some((player) => player.id === playerId)) {
        failure = { message: "현재 방의 참여자가 아닙니다.", status: 403 };
        return current;
      }
      if (game.currentPlayerId !== playerId) {
        failure = { message: "현재 차례인 참여자만 입력할 수 있습니다.", status: 409 };
        return current;
      }
      if (game.turnStartedAt && now - game.turnStartedAt >= game.turnSeconds * 1_000) {
        failure = { message: "입력 시간이 지나 턴이 넘어갔습니다.", status: 409 };
        return current;
      }

      let answer: string;
      try {
        answer = decryptNumberBaseballAnswer(game.answerToken ?? "", secret);
      } catch {
        failure = { message: "숫자야구 정답 상태를 확인할 수 없습니다.", status: 500 };
        return current;
      }
      feedback = evaluateNumberBaseballGuess(answer, guess);
      const player = game.players[playerId] ?? players.find((candidate) => candidate.id === playerId);
      if (!player) {
        failure = { message: "참여자 정보를 확인할 수 없습니다.", status: 409 };
        return current;
      }
      const nextGame = applyNumberBaseballTurn(game, {
        playerId,
        playerName: player.name,
        guess,
        feedback,
        round: game.round,
        at: now,
      });
      const nextRoom = { ...room, numberBaseballGame: nextGame, status: nextGame.status === "finished" ? "finished" : "playing" };
      if (nextGame.status === "finished") delete nextRoom.turnStartedAt;
      return removeUndefined(nextRoom);
    });

    const transactionFailure = readNumberBaseballTransactionFailure(failure);
    if (transactionFailure) return NextResponse.json({ message: transactionFailure.message }, { status: transactionFailure.status });
    if (!result.committed || !feedback) return NextResponse.json({ message: "입력을 저장하지 못했습니다." }, { status: 409 });
    const game = result.snapshot.child("numberBaseballGame").val() as NumberBaseballGame | null;
    return NextResponse.json({
      ok: true,
      feedback,
      status: game?.status,
      currentPlayerId: game?.currentPlayerId,
      winnerId: game?.winnerId,
      finishReason: game?.finishReason,
    });
  } catch {
    return NextResponse.json({ message: "숫자야구 입력을 저장하지 못했습니다." }, { status: 500 });
  }
}
