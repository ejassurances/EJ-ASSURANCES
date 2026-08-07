import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendClientRelance } from "@/lib/email/gmail";

export async function POST(req: NextRequest) {
  // Vérification de l'authentification admin
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Vérification du rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "courtier"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { fullName, email, subject, message, advisorName } = body;

  if (!fullName || !email || !subject || !message) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const result = await sendClientRelance({
    fullName,
    email,
    subject,
    body: message,
    advisorName,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: result.id });
}
