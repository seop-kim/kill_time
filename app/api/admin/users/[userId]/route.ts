import { NextRequest, NextResponse } from "next/server";
import { getAdminUserDetail, isFirebaseAdminConfigured } from "@/lib/adminData";
import { getAdminSessionForRequest } from "@/lib/adminRoute";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!getAdminSessionForRequest(request)) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ message: "Firebase 관리자 권한이 아직 설정되지 않았습니다." }, { status: 503 });
  const { userId } = await params;
  const user = await getAdminUserDetail(userId);
  if (!user) return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ user });
}
