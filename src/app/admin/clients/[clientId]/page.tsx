import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { archiveClientAction, getClient360 } from "@/lib/actions/clients";
import { getClientProjects } from "@/lib/actions/projects";
import { ClientFile360Live } from "@/components/client-file-360-live";
import { ArrowLeft, FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) return { title: "Client — EJ Partners Assurances Admin" };
  const data = await getClient360(clientId);
  return { title: `${data?.client?.full_name ?? "Client"} — EJ Partners Assurances Admin` };
}

export default async function AdminClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) redirect("/connexion");

  const data = await getClient360(clientId);
  if (!data) notFound();
  const projects = await getClientProjects(clientId);

  const supabase = await createSupabaseServerClient();
  let emprunteurDossierId: string | null = null;
  let emprunteurDossierSource: string | null = null;
  if (supabase) {
    const { data: dos } = await supabase
      .from("emprunteur_dossiers")
      .select("id, source")
      .eq("client_id", clientId)
      .maybeSingle();
    emprunteurDossierId = dos?.id ?? null;
    emprunteurDossierSource = dos?.source ?? null;
  }

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      <div className="bo-fichehead">
        <div>
          <Link href="/admin/clients" className="bo-back">
            <ArrowLeft size={15} aria-hidden /> Retour à la liste
          </Link>
          <h1>{data.client.full_name ?? "Client sans nom"}</h1>
          <p className="sub">
            Fiche 360° — {data.contracts.length} contrat{data.contracts.length !== 1 ? "s" : ""},{" "}
            {data.interactions.length} interaction{data.interactions.length !== 1 ? "s" : ""},{" "}
            {data.related_persons.length} personne{data.related_persons.length !== 1 ? "s" : ""} liée{data.related_persons.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bo-fichehead-actions">
          <Link href={`/admin/clients/${clientId}/modifier`} className="bo-btn bo-btn-secondary">
            Modifier la fiche
          </Link>
          <form action={archiveClientAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="archiveReason" value="Archivage depuis la fiche client admin." />
            <button className="bo-btn bo-btn-danger-soft" type="submit">
              Archiver
            </button>
          </form>
        </div>
      </div>

      {emprunteurDossierId && (
        <Link href="/admin/emprunteur" className="bo-source-banner">
          <FileText size={15} aria-hidden />
          <span>
            {emprunteurDossierSource === "recueil"
              ? "Projet Assurance Emprunteur issu du recueil des besoins"
              : "Ce client provient du tunnel Assurance Emprunteur"}
          </span>
          <span className="lnk">Voir le dossier →</span>
        </Link>
      )}

      <ClientFile360Live
        clientId={clientId}
        initialData={{ ...data, projects }}
      />
    </AppShell>
  );
}
