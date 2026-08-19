import type { ParticipantRole } from "./rooms";

export interface StoredIdentity {
  role: ParticipantRole;
  name: string;
  participantId?: string;
  /** Stable browser-level identity shared across rooms and games. */
  userId?: string;
}

const STORAGE_PREFIX = "kt_room_";
export const USER_ID_STORAGE_KEY = "kt_user_id";

function generateUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) return existing;

  const userId = generateUserId();
  localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  return userId;
}

export function saveIdentity(code: string, identity: StoredIdentity) {
  localStorage.setItem(STORAGE_PREFIX + code, JSON.stringify(identity));
}

export function loadIdentity(code: string): StoredIdentity | null {
  const raw = localStorage.getItem(STORAGE_PREFIX + code);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return null;
  }
}
