import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateUserId, USER_ID_STORAGE_KEY } from "./identity";

describe("getOrCreateUserId", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates and reuses one browser user id", () => {
    const first = getOrCreateUserId();

    expect(first).toBeTruthy();
    expect(values.get(USER_ID_STORAGE_KEY)).toBe(first);
    expect(getOrCreateUserId()).toBe(first);
  });
});
