import { CurrentUser } from "@/lib/auth";
import { ClientRecord, toClientOption } from "@/lib/client-records";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAccessibleClients(user: CurrentUser) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("clients")
    .select("id, full_name, email, phone, family_context, notes, created_at")
    .is("archived_at", null) // les fiches archivées ne comptent plus / n'apparaissent plus
    .order("created_at", { ascending: false });

  if (user.role === "client") {
    query = query.eq("profile_id", user.id);
  }

  if (user.role === "mandataire") {
    const { data: mandataire } = await supabase
      .from("mandataires")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!mandataire) {
      return [];
    }

    query = query.eq("mandataire_id", mandataire.id);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []) as ClientRecord[];
}

export async function getClientWithAssessments(user: CurrentUser, clientId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  let query = supabase
    .from("clients")
    .select(
      `
        id,
        full_name,
        email,
        phone,
        family_context,
        notes,
        created_at,
        needs_assessments (
          id,
          status,
          family_situation,
          legal_status,
          protection_goal,
          family_protection_score,
          created_at
        )
      `,
    )
    .eq("id", clientId);

  if (user.role === "client") {
    query = query.eq("profile_id", user.id);
  }

  if (user.role === "mandataire") {
    const { data: mandataire } = await supabase
      .from("mandataires")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!mandataire) {
      return null;
    }

    query = query.eq("mandataire_id", mandataire.id);
  }

  const { data } = await query.maybeSingle();

  return data as ClientRecord | null;
}

export function toAssessmentClientOptions(clients: ClientRecord[]) {
  return clients.map(toClientOption);
}
