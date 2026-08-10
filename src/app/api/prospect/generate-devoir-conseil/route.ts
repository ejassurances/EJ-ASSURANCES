// Brique 3 — génération de la Fiche de Devoir de Conseil (DDA étape 2).
//   POST /api/prospect/generate-devoir-conseil
//   Déclenché quand une tarification est validée (courtier ou agent IA).
//   Réservé au personnel du cabinet (admin / courtier).
//   1. Demande la génération de la fiche à Apps Script (action
//      "generer_devoir_de_conseil") — dépôt Drive + PDF.
//   2. Bascule projects.status → 'proposal' (statut métier DEVOIR_CONSEIL_EMIS).

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { postToAppsScript } from "@/lib/webhook/apps-script";
import { mapExternalProjectStatus } from "@/lib/crm/project-status";

// Champs transmis tels quels à Apps Script pour composer la fiche.
const FIELDS = [
  "nomComplet",
  "typeAssurance",
  "garantiesSouhaitees",
  "budgetCible",
  "assureurRecommande",
  "produitRecommande",
  "tarifRecommande",
  "assureurOption2",
  "produitOption2",
  "tarifOption2",
  "motif1",
  "motif2",
  "motif3",
] as const;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const clientFolderId = String(body.clientFolderId ?? "").trim();
    if (!projectId || !clientFolderId) {
      return NextResponse.json({ error: "projectId et clientFolderId sont requis" }, { status: 400 });
    }
    if (!body.assureurRecommande || !body.produitRecommande) {
      return NextResponse.json(
        { error: "assureurRecommande et produitRecommande sont requis" },
        { status: 400 },
      );
    }

    // Payload Apps Script : action + projet/dossier + champs de la fiche.
    const payload: Record<string, unknown> = {
      action: "generer_devoir_de_conseil",
      projectId,
      clientFolderId,
    };
    for (const f of FIELDS) payload[f] = body[f] != null ? String(body[f]) : "";

    const webhook = await postToAppsScript(payload);
    if (!webhook.ok) {
      return NextResponse.json(
        { error: `Génération Apps Script échouée : ${webhook.error ?? "inconnu"}` },
        { status: 502 },
      );
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    // Bascule du statut projet (DEVOIR_CONSEIL_EMIS → enum 'proposal').
    const mapped = mapExternalProjectStatus("DEVOIR_CONSEIL_EMIS")!;
    const { data: project } = await supabase
      .from("projects")
      .update({
        status: mapped.status,
        workflow_stage: mapped.workflowStage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select("id, client_id")
      .single();

    // Journal d'activité.
    if (project) {
      await supabase.from("interactions").insert({
        client_id: project.client_id,
        author_id: user.id,
        type: "document",
        titre: mapped.label,
        contenu: `Devoir de conseil émis — recommandation : ${String(body.assureurRecommande)} / ${String(body.produitRecommande)}${body.tarifRecommande ? ` (${String(body.tarifRecommande)})` : ""}.`,
      });
    }

    return NextResponse.json({
      ok: true,
      projectId,
      status: mapped.status,
      workflowStage: mapped.workflowStage,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
