import { NextRequest, NextResponse } from "next/server";
import { archiveFinishedGameRecord, isFirebaseAdminConfigured } from "@/lib/adminData";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ archived: false });
  let roomCode = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    roomCode = typeof body.roomCode === "string" ? body.roomCode : "";
  } catch {
    return NextResponse.json({ message: "방 코드를 확인할 수 없습니다." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{6}$/i.test(roomCode.trim())) {
    return NextResponse.json({ message: "방 코드를 확인할 수 없습니다." }, { status: 400 });
  }

  try {
    const record = await archiveFinishedGameRecord(roomCode);
    return NextResponse.json({ archived: Boolean(record), recordId: record?.id });
  } catch {
    return NextResponse.json({ archived: false });
  }
}
