import { AcprDocument } from "@/components/client-acpr-folder";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClientDashboard, LettreMissionSummary } from "./ClientDashboard";

export default async function ClientDashboardPage() {
  const user = await requireRole(["client"]);
  const supabase = await createSupabaseServerClient();
  let acprDocuments: AcprDocument[] = [];
  let lettres: LettreMissionSummary[] = [];
  let driveFolderId: string | null = null;
  const pieceStatuses: Record<string, "processing" | "received"> = {};

  // document_type CRM → type de pièce du portail prospect.
  const DOC_TYPE_TO_PIECE: Record<string, string> = {
    identity: "CNI_PASSEPORT",
    rib: "RIB",
    current_insurance_certificate: "RELEVE_INFORMATION",
    proof_of_address: "JUSTIFICATIF_DOMICILE",
    income_proof: "BULLETIN_SALAIRE",
  };

  if (supabase) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, google_drive_folder_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (client) {
      driveFolderId = client.google_drive_folder_id ?? null;

      const { data } = await supabase
        .from("documents")
        .select("id, storage_path, document_type, created_at")
        .eq("client_id", client.id)
        .eq("document_type", "classeur_acpr_der")
        .order("created_at", { ascending: false });

      acprDocuments = data ?? [];

      // Statuts des pièces déposées (🟡 en cours / 🟢 reçu).
      const { data: pieces } = await supabase
        .from("documents")
        .select("document_type, status, created_at")
        .eq("client_id", client.id)
        .in("document_type", Object.keys(DOC_TYPE_TO_PIECE))
        .order("created_at", { ascending: true });

      for (const piece of pieces ?? []) {
        const key = DOC_TYPE_TO_PIECE[piece.document_type as string];
        if (!key) continue;
        pieceStatuses[key] =
          piece.status === "received" || piece.status === "validated" ? "received" : "processing";
      }

      const { data: lettresData } = await supabase
        .from("lettres_mission")
        .select("id, reference, product, status, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      lettres = (lettresData as LettreMissionSummary[]) ?? [];
    }
  }

  return (
    <ClientDashboard
      acprDocuments={acprDocuments}
      lettres={lettres}
      user={user}
      driveFolderId={driveFolderId}
      pieceStatuses={pieceStatuses}
    />
  );
}
