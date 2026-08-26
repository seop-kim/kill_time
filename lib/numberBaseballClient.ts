type NumberBaseballResponse = {
  message?: string;
  [key: string]: unknown;
};

async function postNumberBaseball(path: string, body: Record<string, unknown>): Promise<NumberBaseballResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as NumberBaseballResponse;
  if (!response.ok) throw new Error(payload.message ?? "숫자야구 요청을 처리하지 못했습니다.");
  return payload;
}

export function startNumberBaseball(code: string, actorId: string): Promise<NumberBaseballResponse> {
  return postNumberBaseball("/api/number-baseball/start", { roomCode: code, actorId });
}

export function submitNumberBaseballGuess(code: string, playerId: string, guess: string): Promise<NumberBaseballResponse> {
  return postNumberBaseball("/api/number-baseball/guess", { roomCode: code, playerId, guess });
}

export function timeoutNumberBaseballTurn(code: string, playerId: string): Promise<NumberBaseballResponse> {
  return postNumberBaseball("/api/number-baseball/timeout", { roomCode: code, playerId });
}

export function restartNumberBaseball(code: string, actorId: string): Promise<NumberBaseballResponse> {
  return postNumberBaseball("/api/number-baseball/restart", { roomCode: code, actorId });
}
