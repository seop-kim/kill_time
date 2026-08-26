import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function keyFromSecret(secret: string): Buffer {
  if (!secret) throw new Error("숫자야구 암호화 비밀키가 없습니다.");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptNumberBaseballAnswer(answer: string, secret: string): string {
  if (!/^\d{3}$/.test(answer) || new Set(answer).size !== 3) throw new Error("숫자야구 정답 형식이 올바르지 않습니다.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(answer, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptNumberBaseballAnswer(token: string, secret: string): string {
  const [ivValue, tagValue, encryptedValue] = token.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("숫자야구 정답 토큰이 올바르지 않습니다.");
  const decipher = createDecipheriv(ALGORITHM, keyFromSecret(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const answer = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  if (!/^\d{3}$/.test(answer) || new Set(answer).size !== 3) throw new Error("숫자야구 정답 토큰의 내용이 올바르지 않습니다.");
  return answer;
}
