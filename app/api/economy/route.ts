import { NextResponse } from "next/server";
import {
  getAdminEconomySettings,
  getDefaultAdminEconomySettings,
  isFirebaseAdminConfigured,
} from "@/lib/adminData";

export const runtime = "nodejs";

export async function GET() {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ settings: getDefaultAdminEconomySettings(), source: "default" });
  }

  try {
    return NextResponse.json({ settings: await getAdminEconomySettings(), source: "admin" });
  } catch {
    return NextResponse.json({ settings: getDefaultAdminEconomySettings(), source: "default" });
  }
}
