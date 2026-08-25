import { NextRequest, NextResponse } from "next/server";
import { getAdminEconomySettings, isFirebaseAdminConfigured, saveAdminEconomySettings } from "@/lib/adminData";
import { getAdminSessionForRequest } from "@/lib/adminRoute";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ message: "Firebase 관리자 권한이 아직 설정되지 않았습니다." }, { status: 503 });
}

export async function GET(request: NextRequest) {
  if (!getAdminSessionForRequest(request)) return unauthorized();
  if (!isFirebaseAdminConfigured()) return unavailable();
  return NextResponse.json({ settings: await getAdminEconomySettings() });
}

export async function PUT(request: NextRequest) {
  const session = getAdminSessionForRequest(request);
  if (!session) return unauthorized();
  if (!isFirebaseAdminConfigured()) return unavailable();
  try {
    return NextResponse.json({ settings: await saveAdminEconomySettings(await request.json(), session.loginId) });
  } catch {
    return NextResponse.json({ message: "경제 설정을 저장하지 못했습니다." }, { status: 400 });
  }
}
