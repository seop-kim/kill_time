import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  getAdminSessionSecretFromEnv,
  isValidAdminCredential,
  verifyAdminSessionToken,
} from "./adminAuth";

const secret = "test-session-secret-that-is-long-enough";
const credentials = {
  loginId: "operator",
  loginPassword: "correct-horse-battery-staple",
};

describe("administrator session", () => {
  it("accepts only the configured administrator ID and password", () => {
    expect(isValidAdminCredential("operator", "correct-horse-battery-staple", credentials)).toBe(true);
    expect(isValidAdminCredential("operator", "wrong-password", credentials)).toBe(false);
    expect(isValidAdminCredential("someone-else", "correct-horse-battery-staple", credentials)).toBe(false);
  });

  it("verifies a signed session only until its expiry", () => {
    const issuedAt = 1_700_000_000_000;
    const token = createAdminSessionToken("operator", secret, issuedAt);

    expect(verifyAdminSessionToken(token, secret, issuedAt + 7 * 60 * 60 * 1_000)).toEqual({
      loginId: "operator",
      issuedAt,
      expiresAt: issuedAt + 8 * 60 * 60 * 1_000,
    });
    expect(verifyAdminSessionToken(token, secret, issuedAt + 8 * 60 * 60 * 1_000)).toBeNull();
  });

  it("rejects a token when either its payload or signature is changed", () => {
    const token = createAdminSessionToken("operator", secret, 1_700_000_000_000);
    const [payload, signature] = token.split(".");

    expect(verifyAdminSessionToken(`${payload}.changed${signature}`, secret, 1_700_000_000_001)).toBeNull();
    expect(verifyAdminSessionToken(`changed${payload}.${signature}`, secret, 1_700_000_000_001)).toBeNull();
  });

  it("uses the administrator password as the session signing secret when no separate secret is configured", () => {
    const originalPassword = process.env.ADMIN_LOGIN_PASSWORD;
    const originalSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_LOGIN_PASSWORD = "strong-admin-password";
    delete process.env.ADMIN_SESSION_SECRET;

    expect(getAdminSessionSecretFromEnv()).toBe("strong-admin-password");

    if (originalPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
    else process.env.ADMIN_LOGIN_PASSWORD = originalPassword;
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalSecret;
  });
});
