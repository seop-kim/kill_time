"use client";

import { ErrorPage } from "@/components/ErrorPage";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <ErrorPage
      title="오류가 발생했습니다."
      message={error.message ? "문서를 불러오는 중 문제가 발생했습니다." : "잠시 후 다시 시도해 주세요."}
    />
  );
}
