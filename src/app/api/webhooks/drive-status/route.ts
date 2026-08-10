// Brique 2 — synchronisation des statuts Google Drive → Supabase CRM.
//   POST /api/webhooks/drive-status
//   Émis par Google Apps Script à chaque étape clé du dossier.
//   Sécurité : req.body.token === process.env.DRIVE_WEBHOOK_SECRET.
//
//   Payload : { projectId, status, driveFolderId?, fileUrl?, timestamp? }
//   Effets :
//     - projects.status  = enum mappé depuis le statut métier reçu
//     - projects.workflow_stage = statut brut (LEAD_NOUVEAU, …) sans perte
//     - projects.google_drive_folder_id = driveFolderId (si fourni)
//     - interactions : journal d'activité (libellé + lien document)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { mapExternalProjectStatus } from "@/lib/crm/project-status";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    // Validation de sécurité (jeton partagé).
    const secret = process.env.DRIVE_WEBHOOK_SECRET;
    if (!secret || body.token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const rawStatus = String(body.status ?? "").trim();
    const driveFolderId = body.driveFolderId ? String(body.driveFolderId).trim() : null;
    const fileUrl = body.fileUrl ? String(body.fileUrl).trim() : null;
    const timestamp = body.timestamp ? String(body.timestamp) : new Date().toISOString();

    if (!projectId || !rawStatus) {
      return NextResponse.json({ error: "projectId et status sont requis" }, { status: 400 });
    }

    const mapped = mapExternalProjectStatus(rawStatus);
    if (!mapped) {
      return NextResponse.json({ error: `Statut inconnu : ${rawStatus}` }, { status: 422 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    // 1. Mise à jour du projet.
    const update: Record<string, unknown> = {
      status: mapped.status,
      workflow_stage: mapped.workflowStage,
      updated_at: new Date().toISOString(),
    };
    if (driveFolderId) update.google_drive_folder_id = driveFolderId;

    const { data: project, error: projError } = await supabase
      .from("projects")
      .update(update)
      .eq("id", projectId)
      .select("id, client_id")
      .single();

    if (projError || !project) {
      return NextResponse.json(
        { error: `Projet introuvable ou non mis à jour : ${projError?.message ?? projectId}` },
        { status: 404 },
      );
    }

    // 2. Journal d'activité (interactions).
    const contenu = [
      `Étape « ${mapped.label} » (${mapped.workflowStage}).`,
      fileUrl ? `Document : ${fileUrl}` : null,
      `Reçu le ${timestamp}.`,
    ]
      .filter(Boolean)
      .join(" ");

    await supabase.from("interactions").insert({
      client_id: project.client_id,
      type: fileUrl ? "document" : "note",
      titre: mapped.label,
      contenu,
    });

    return NextResponse.json({
      ok: true,
      projectId: project.id,
      status: mapped.status,
      workflowStage: mapped.workflowStage,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
