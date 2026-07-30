import { NextRequest, NextResponse } from "next/server";
import { runPhoneConsentCampaign } from "@/app/actions/phone-consent";

export const dynamic = "force-dynamic";

// Campagne planifiée de confirmation du consentement téléphonique.
// Déclenchée par Vercel Cron (voir vercel.json) : Vercel joint l'en-tête
// Authorization: Bearer <CRON_SECRET> lorsque la variable CRON_SECRET est définie.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runPhoneConsentCampaign();
  return NextResponse.json({ ok: true, ...result });
}
