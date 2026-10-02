import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPhoneConsentCampaign } from "@/app/actions/phone-consent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSecretEquals(value: string | null, expected: string | undefined): boolean {
  if (!value || !expected) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Campagne planifiée de confirmation du consentement téléphonique.
// Déclenchée par Vercel Cron (voir vercel.json).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!safeSecretEquals(auth, secret ? `Bearer ${secret}` : undefined)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runPhoneConsentCampaign();
  return NextResponse.json({ ok: true, ...result });
}
