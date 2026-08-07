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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const folderId = formData.get("folder_id") as string

    if (!file || !folderId) {
      return NextResponse.json({ error: "file and folder_id required" }, { status: 400 })
    }

    const token = await getOAuthToken()
    const arrayBuffer = await file.arrayBuffer()

    const metadata = { name: file.name, mimeType: file.type, parents: [folderId] }
    const boundary = "----EJAssurancesUpload"

    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${file.type}`,
      "",
      ""
    ].join("\r\n")

    const bodyBytes = new TextEncoder().encode(body)
    const fileBytes = new Uint8Array(arrayBuffer)
    const endBytes = new TextEncoder().encode(`\r\n--${boundary}--`)
    const combined = new Uint8Array(bodyBytes.length + fileBytes.length + endBytes.length)
    combined.set(bodyBytes, 0)
    combined.set(fileBytes, bodyBytes.length)
    combined.set(endBytes, bodyBytes.length + fileBytes.length)

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: combined
      }
    )

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || "Upload failed")
    return NextResponse.json({ success: true, file: data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
