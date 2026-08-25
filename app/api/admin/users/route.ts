import { NextRequest, NextResponse } from "next/server";
import { findAdminUsers, isFirebaseAdminConfigured } from "@/lib/adminData";
import { getAdminSessionForRequest } from "@/lib/adminRoute";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!getAdminSessionForRequest(request)) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ message: "Firebase 관리자 권한이 아직 설정되지 않았습니다." }, { status: 503 });

  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (!query.trim()) return NextResponse.json({ users: [] });
  return NextResponse.json({ users: await findAdminUsers(query) });
}
