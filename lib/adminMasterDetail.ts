export interface AdminRoomSummary {
  roomCode: string;
  count: number;
  latestAt: number;
  preview: string;
}

type ChatRoomEntry = { roomCode: string; text: string; at: number };
type GameRoomEntry = { roomCode: string; gameId: string; finishedAt: number };

function summarizeRooms<T extends { roomCode: string }>(
  entries: T[],
  getAt: (entry: T) => number,
  getPreview: (entry: T) => string,
): AdminRoomSummary[] {
  const rooms = new Map<string, AdminRoomSummary>();

  for (const entry of entries) {
    const roomCode = entry.roomCode.trim().toUpperCase();
    if (!roomCode) continue;
    const at = getAt(entry);
    const previous = rooms.get(roomCode);
    if (!previous) {
      rooms.set(roomCode, { roomCode, count: 1, latestAt: at, preview: getPreview(entry) });
      continue;
    }

    previous.count += 1;
    if (at >= previous.latestAt) {
      previous.latestAt = at;
      previous.preview = getPreview(entry);
    }
  }

  return [...rooms.values()].sort((left, right) => right.latestAt - left.latestAt || left.roomCode.localeCompare(right.roomCode));
}

export function summarizeChatRooms(entries: ChatRoomEntry[]): AdminRoomSummary[] {
  return summarizeRooms(entries, (entry) => entry.at, (entry) => entry.text);
}

export function summarizeGameRooms(entries: GameRoomEntry[]): AdminRoomSummary[] {
  return summarizeRooms(entries, (entry) => entry.finishedAt, (entry) => entry.gameId);
}
