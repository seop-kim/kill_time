import { onValue, ref, set } from "firebase/database";
import { ensureFirebaseAuth, getDb } from "./firebase";

export async function saveProfileNickname(userId: string, nickname: string): Promise<void> {
  await ensureFirebaseAuth();
  await set(ref(getDb(), `profiles/${userId}/nickname`), nickname);
}

export function subscribeProfileNickname(userId: string, callback: (nickname: string) => void): () => void {
  return onValue(ref(getDb(), `profiles/${userId}/nickname`), (snapshot) => {
    callback(typeof snapshot.val() === "string" ? snapshot.val() : "");
  });
}
