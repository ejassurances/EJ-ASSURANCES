import { AcprDocument } from "@/components/client-acpr-folder";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClientDashboard, LettreMissionSummary } from "./ClientDashboard";

export default async function ClientDashboardPage() {
  const user = await requireRole(["client"]);
  const supabase = await createSupabaseServerClient();
  let acprDocuments: AcprDocument[] = [];
  let lettres: LettreMissionSummary[] = [];
  let clientId: string | null = null;

  if (supabase) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (client) {
      clientId = client.id as string;
      const { data } = await supabase
        .from("documents")
        .select("id, storage_path, document_type, created_at")
        .eq("client_id", client.id)
        .eq("document_type", "classeur_acpr_der")
        .order("created_at", { ascending: false });

      acprDocuments = data ?? [];

      const { data: lettresData } = await supabase
        .from("lettres_mission")
        .select("id, reference, product, status, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      lettres = (lettresData as LettreMissionSummary[]) ?? [];
    }
  }

  return <ClientDashboard acprDocuments={acprDocuments} lettres={lettres} user={user} clientId={clientId} />;
}
