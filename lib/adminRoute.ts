import "server-only";

import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionSecretFromEnv,
  verifyAdminSessionToken,
} from "./adminAuth";

export function getAdminSessionForRequest(request: NextRequest) {
  const secret = getAdminSessionSecretFromEnv();
  if (!secret) return null;
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, secret);
}
