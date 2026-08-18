import type { PlayerRole } from "./rooms";

export interface StoredIdentity {
  role: PlayerRole;
  name: string;
}

const STORAGE_PREFIX = "kt_room_";

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
