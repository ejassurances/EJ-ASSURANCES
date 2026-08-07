import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleWorkspaceAuthUrl, isGoogleWorkspaceConfigured } from "@/lib/google/workspace";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  if (!["admin", "courtier"].includes(user.role)) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  if (!isGoogleWorkspaceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Google Workspace n'est pas encore configuré. Ajoutez GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_CLIENT_SECRET et GOOGLE_WORKSPACE_REDIRECT_URI.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    authUrl: getGoogleWorkspaceAuthUrl(),
  });
}
