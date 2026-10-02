import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { runPhoneConsentCampaign } from "@/app/actions/phone-consent"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function validCronAuthorization(auth: string | null, secret: string | undefined): boolean {
  if (!auth || !secret) return false
  const expected = `Bearer ${secret}`
  const actual = Buffer.from(auth)
  const target = Buffer.from(expected)
  return actual.length === target.length && timingSafeEqual(actual, target)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")

  if (!validCronAuthorization(auth, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const result = await runPhoneConsentCampaign()
  return NextResponse.json({ ok: true, ...result })
}
