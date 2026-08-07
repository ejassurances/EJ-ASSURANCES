import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { createSupabaseServiceClient } from "@/lib/supabase/server"

async function getOAuthToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token"
    })
  })
  const { access_token, error } = await res.json()
  if (error) throw new Error("OAuth: " + error)
  return access_token
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("client_id")
    const clientEmail = searchParams.get("email")

    if (!clientId && !clientEmail) {
      return NextResponse.json({ error: "client_id or email required" }, { status: 400 })
    }

    let email = clientEmail
    if (!email && clientId) {
      const { data } = await supabase.from("clients").select("email").eq("id", clientId).single()
      email = data?.email
    }

    if (!email) return NextResponse.json({ error: "Client email not found" }, { status: 404 })

    const token = await getOAuthToken()
    const query = encodeURIComponent(`from:${email} OR to:${email}`)
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const { threads = [] } = await res.json()

    // Fetch stored summaries from email_logs
    const { data: logs } = await supabase
      .from("email_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("received_at", { ascending: false })
      .limit(20)

    return NextResponse.json({ threads, logs: logs || [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
