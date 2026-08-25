import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionSecretFromEnv,
  verifyAdminSessionToken,
} from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const secret = getAdminSessionSecretFromEnv();
  const session = secret
    ? verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, secret)
    : null;

  return NextResponse.json(
    session ? { authenticated: true, loginId: session.loginId } : { authenticated: false },
    { status: session ? 200 : 401 },
  );
}
