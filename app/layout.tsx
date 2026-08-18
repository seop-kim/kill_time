import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "실적관리_2026.xlsx - Excel",
  description: "실적관리_2026.xlsx",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sheet bg-[#f3f2f1]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
