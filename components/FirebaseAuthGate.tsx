"use client";

import { useEffect, useState } from "react";
import { ensureFirebaseAuth } from "@/lib/firebase";

export function FirebaseAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    ensureFirebaseAuth()
      .then(() => setReady(true))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#f3f2f1] px-4 text-center">
        <div className="w-[420px] rounded-sm border border-[#d0d0d0] bg-white px-5 py-4 shadow-sm">
          <p className="text-[14px] font-semibold text-[#333]">Firebase 인증을 사용할 수 없습니다.</p>
          <p className="mt-2 text-[11px] leading-relaxed text-[#666]">
            Firebase Console의 Authentication에서 익명 로그인 제공자를 활성화한 뒤 다시 시도해 주세요.
          </p>
        </div>
      </main>
    );
  }

  if (!ready) return <div className="min-h-full bg-[#f3f2f1]" />;
  return <>{children}</>;
}
