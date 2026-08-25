import { describe, expect, it } from "vitest";
import { summarizeChatRooms, summarizeGameRooms } from "./adminMasterDetail";

describe("administrator master-detail lists", () => {
  it("groups every chat message by room and puts the most recently active room first", () => {
    expect(summarizeChatRooms([
      { roomCode: "AB12CD", text: "먼저 보낸 메시지", at: 100 },
      { roomCode: "EF34GH", text: "가장 최근 메시지", at: 300 },
      { roomCode: "AB12CD", text: "AB의 마지막 메시지", at: 200 },
    ])).toEqual([
      { roomCode: "EF34GH", count: 1, latestAt: 300, preview: "가장 최근 메시지" },
      { roomCode: "AB12CD", count: 2, latestAt: 200, preview: "AB의 마지막 메시지" },
    ]);
  });

  it("groups game records by room and keeps the latest game label for the room", () => {
    expect(summarizeGameRooms([
      { roomCode: "AB12CD", gameId: "omok", finishedAt: 100 },
      { roomCode: "EF34GH", gameId: "girin", finishedAt: 300 },
      { roomCode: "AB12CD", gameId: "seotda", finishedAt: 200 },
    ])).toEqual([
      { roomCode: "EF34GH", count: 1, latestAt: 300, preview: "girin" },
      { roomCode: "AB12CD", count: 2, latestAt: 200, preview: "seotda" },
    ]);
  });
});
