import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { createSupabaseServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
    }

    const supabase = createSupabaseServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 })
    }

    const body = await req.json()
    const { bulletin_text, assureur, periode } = body

    if (!bulletin_text) {
      return NextResponse.json({ error: "bulletin_text required" }, { status: 400 })
    }

    const { data, error } = await supabase.functions.invoke("ai-agent-gemini", {
      body: {
        action: "reconcile_commissions",
        bulletin_text: `Assureur: ${assureur || "inconnu"}\nPeriode: ${periode || "inconnu"}\n\n${bulletin_text}`
      }
    })

    if (error) throw error
    return NextResponse.json({ success: true, result: data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
