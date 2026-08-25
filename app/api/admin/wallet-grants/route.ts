import { NextRequest, NextResponse } from "next/server";
import { grantAdminWallet, isFirebaseAdminConfigured } from "@/lib/adminData";
import { parseAdminWalletGrant } from "@/lib/adminOperations";
import { getAdminSessionForRequest } from "@/lib/adminRoute";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getAdminSessionForRequest(request);
  if (!session) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ message: "Firebase 관리자 권한이 아직 설정되지 않았습니다." }, { status: 503 });
  }

  let grant = null;
  try {
    grant = parseAdminWalletGrant(await request.json());
  } catch {
    // The common response below does not reveal request parsing details.
  }
  if (!grant) return NextResponse.json({ message: "지급 정보를 확인해 주세요." }, { status: 400 });

  try {
    return NextResponse.json(await grantAdminWallet(grant, session.loginId));
  } catch {
    return NextResponse.json({ message: "지갑 지급을 완료하지 못했습니다." }, { status: 500 });
  }
}
