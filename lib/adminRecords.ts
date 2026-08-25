import { getMatchParticipants, normalizeRoomGameId, type Room, type RoomGameId } from "./rooms";

export interface GameRecordParticipant {
  participantId: string;
  userId?: string;
  name: string;
}

export interface GameRecord {
  id: string;
  roomCode: string;
  gameId: RoomGameId;
  startedAt: number;
  finishedAt: number;
  participants: GameRecordParticipant[];
  outcome: Record<string, unknown>;
}

function getRoomParticipantMap(room: Room) {
  return new Map(getMatchParticipants(room).map((participant) => [participant.id, participant]));
}

function getStandardParticipants(room: Room): GameRecordParticipant[] {
  return getMatchParticipants(room).map(({ id, userId, name }) => ({
    participantId: id,
    ...(userId ? { userId } : {}),
    name,
  }));
}

function getSeotdaParticipants(room: Room): GameRecordParticipant[] {
  if (!room.seotdaGame) return getStandardParticipants(room);
  const knownParticipants = getRoomParticipantMap(room);
  return Object.values(room.seotdaGame.players)
    .sort((left, right) => left.seat - right.seat)
    .map((player) => {
      const participant = knownParticipants.get(player.id);
      return {
        participantId: player.id,
        ...(player.userId ?? participant?.userId ? { userId: player.userId ?? participant?.userId } : {}),
        name: player.name,
      };
    });
}

function getRecordIdentity(roomCode: string, gameId: RoomGameId, room: Room) {
  if (gameId === "seotda") return room.seotdaGame?.matchId ?? `${room.gameStartedAt ?? "unknown"}`;
  if (gameId === "girin") return `${room.girinGame?.startedAt ?? room.gameStartedAt ?? "unknown"}`;
  if (gameId === "minesweeper") return room.minesweeperGame?.matchId ?? `${room.gameStartedAt ?? "unknown"}`;
  return `${room.gameStartedAt ?? "unknown"}`;
}

export function buildFinishedGameRecord(roomCode: string, room: Room, archivedAt = Date.now()): GameRecord | null {
  if (room.status !== "finished") return null;

  const gameId = normalizeRoomGameId(room.gameId);
  const startedAt = room.gameStartedAt ?? room.girinGame?.startedAt ?? room.minesweeperGame?.startedAt ?? archivedAt;
  const id = `${roomCode}:${gameId}:${getRecordIdentity(roomCode, gameId, room)}`;

  if (gameId === "seotda" && room.seotdaGame) {
    const finishedAt = room.seotdaGame.lastAction?.at ?? room.seotdaGame.turnStartedAt ?? archivedAt;
    return {
      id,
      roomCode,
      gameId,
      startedAt,
      finishedAt,
      participants: getSeotdaParticipants(room),
      outcome: {
        winnerIds: room.seotdaGame.winnerIds ?? [],
        pot: room.seotdaGame.pot,
        rounds: room.seotdaGame.round,
      },
    };
  }

  if (gameId === "girin" && room.girinGame) {
    return {
      id,
      roomCode,
      gameId,
      startedAt,
      finishedAt: room.girinGame.finishedAt ?? archivedAt,
      participants: getStandardParticipants(room),
      outcome: {
        winnerIds: room.girinGame.winnerId ? [room.girinGame.winnerId] : [],
        rounds: room.girinGame.currentRound,
        reason: room.girinGame.finishReason ?? "cycle_completed",
      },
    };
  }

  if (gameId === "minesweeper" && room.minesweeperGame) {
    return {
      id,
      roomCode,
      gameId,
      startedAt,
      finishedAt: room.minesweeperGame.finishedAt ?? archivedAt,
      participants: getStandardParticipants(room),
      outcome: { result: room.minesweeperGame.status },
    };
  }

  return {
    id,
    roomCode,
    gameId,
    startedAt,
    finishedAt: archivedAt,
    participants: getStandardParticipants(room),
    outcome: { winner: room.winner },
  };
}
