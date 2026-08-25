import { NextRequest, NextResponse } from "next/server";
import { isFirebaseAdminConfigured, listGameRecords } from "@/lib/adminData";
import { getAdminSessionForRequest } from "@/lib/adminRoute";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!getAdminSessionForRequest(request)) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ message: "Firebase 관리자 권한이 아직 설정되지 않았습니다." }, { status: 503 });
  const params = request.nextUrl.searchParams;
  return NextResponse.json({
    records: await listGameRecords({
      gameId: params.get("gameId") ?? undefined,
      roomCode: params.get("roomCode") ?? undefined,
      limit: Number(params.get("limit") ?? "100"),
    }),
  });
}
