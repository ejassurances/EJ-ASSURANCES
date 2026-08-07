import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

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

    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get("folder_id")
    if (!folderId) return NextResponse.json({ error: "folder_id required" }, { status: 400 })

    const token = await getOAuthToken()
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,webViewLink)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    return NextResponse.json({ files: data.files || [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
