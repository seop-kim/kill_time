import { notFound } from "next/navigation";
import { AdminConsoleClient } from "@/components/AdminConsoleClient";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!process.env.ADMIN_CONSOLE_SLUG || slug !== process.env.ADMIN_CONSOLE_SLUG) notFound();
  return <AdminConsoleClient />;
}
