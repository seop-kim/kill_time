import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "kill_time_admin_session";
export const ADMIN_SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;

export type AdminCredentials = {
  loginId: string;
  loginPassword: string;
};

export type AdminSession = {
  loginId: string;
  issuedAt: number;
  expiresAt: number;
};

type SessionPayload = {
  loginId: string;
  issuedAt: number;
};

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.loginId !== "string" || !payload.loginId || !Number.isFinite(payload.issuedAt)) return null;

    return { loginId: payload.loginId, issuedAt: payload.issuedAt as number };
  } catch {
    return null;
  }
}

export function isValidAdminCredential(loginId: string, password: string, credentials: AdminCredentials) {
  return safeEqual(loginId, credentials.loginId) && safeEqual(password, credentials.loginPassword);
}

export function createAdminSessionToken(loginId: string, secret: string, issuedAt = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ loginId, issuedAt } satisfies SessionPayload)).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined, secret: string, now = Date.now()): AdminSession | null {
  if (!token) return null;

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0 || !safeEqual(signature, signPayload(encodedPayload, secret))) return null;

  const payload = decodePayload(encodedPayload);
  if (!payload) return null;

  const expiresAt = payload.issuedAt + ADMIN_SESSION_DURATION_MS;
  if (payload.issuedAt > now || now >= expiresAt) return null;

  return { ...payload, expiresAt };
}

export function getAdminCredentialsFromEnv(): AdminCredentials | null {
  const loginId = process.env.ADMIN_LOGIN_ID;
  const loginPassword = process.env.ADMIN_LOGIN_PASSWORD;

  return loginId && loginPassword ? { loginId, loginPassword } : null;
}

export function getAdminSessionSecretFromEnv() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_LOGIN_PASSWORD ?? "";
}
