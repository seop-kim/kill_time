"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorPageProps {
  title: string;
  message: string;
  redirectDelayMs?: number;
}

export function ErrorPage({ title, message, redirectDelayMs = 3000 }: ErrorPageProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace("/"), redirectDelayMs);
    return () => window.clearTimeout(timer);
  }, [redirectDelayMs]);

  return (
    <main data-error-page="true" className="flex flex-1 items-center justify-center bg-[#f3f3f3] px-4">
      <section className="w-[420px] border border-[#c9c9c9] bg-white px-7 py-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fce4d6] text-[25px] font-semibold text-[#c65911]">
          !
        </div>
        <h1 className="text-[20px] font-semibold text-[#333]">{title}</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#666]">{message}</p>
        <p className="mt-2 text-[12px] text-[#999]">잠시 후 처음 화면으로 이동합니다.</p>
        <Link
          href="/"
          className="mt-6 inline-flex bg-[#217346] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#1a5c38]"
        >
          처음 화면으로 이동
        </Link>
      </section>
    </main>
  );
}
