import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCredentialsFromEnv,
  getAdminSessionSecretFromEnv,
  isValidAdminCredential,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

function readCredentials(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { loginId, password } = body as Record<string, unknown>;
  if (typeof loginId !== "string" || typeof password !== "string") return null;
  return { loginId, password };
}

export async function POST(request: NextRequest) {
  const credentials = getAdminCredentialsFromEnv();
  const secret = getAdminSessionSecretFromEnv();
  if (!credentials || !secret) {
    return NextResponse.json({ message: "관리자 로그인이 아직 설정되지 않았습니다." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  const submitted = readCredentials(body);
  if (!submitted || !isValidAdminCredential(submitted.loginId, submitted.password, credentials)) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionToken(credentials.loginId, secret),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
