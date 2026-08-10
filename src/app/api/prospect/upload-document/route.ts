// Brique 1 — dépôt d'une pièce justificative par le prospect vers son Drive.
//   POST /api/prospect/upload-document
//   Réservé au prospect authentifié (espace client).
//   1. Transmet le fichier (Base64) au Webhook Apps Script (action "upload_piece")
//      qui le dépose dans le dossier Drive du prospect.
//   2. Enregistre la pièce dans public.documents (status = 'pending_verification').
//      Le statut passera à 'received' via le webhook Drive → CRM (Brique 2).

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { postToAppsScript } from "@/lib/webhook/apps-script";

// Types de pièces acceptés → document_type canonique du CRM.
const PIECE_TO_DOCUMENT_TYPE: Record<string, string> = {
  CNI_PASSEPORT: "identity",
  RIB: "rib",
  RELEVE_INFORMATION: "current_insurance_certificate",
  JUSTIFICATIF_DOMICILE: "proof_of_address",
  BULLETIN_SALAIRE: "income_proof",
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const clientFolderId = String(body.clientFolderId ?? "").trim();
    const typePiece = String(body.typePiece ?? "").trim().toUpperCase();
    const fileName = String(body.fileName ?? "").trim();
    const mimeType = String(body.mimeType ?? "").trim() || "application/octet-stream";
    const fileBlobBase64 = String(body.fileBlobBase64 ?? "");

    if (!clientFolderId || !fileName || !fileBlobBase64) {
      return NextResponse.json(
        { error: "clientFolderId, fileName et fileBlobBase64 sont requis" },
        { status: 400 },
      );
    }
    const documentType = PIECE_TO_DOCUMENT_TYPE[typePiece];
    if (!documentType) {
      return NextResponse.json(
        { error: `typePiece invalide. Attendu : ${Object.keys(PIECE_TO_DOCUMENT_TYPE).join(", ")}` },
        { status: 400 },
      );
    }

    // Fiche client du prospect (pour rattacher la pièce au CRM).
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    // Projet éventuel identifié par le dossier Drive.
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("google_drive_folder_id", clientFolderId)
      .maybeSingle();

    // 1. Dépôt du fichier dans le Drive via Apps Script.
    const webhook = await postToAppsScript({
      action: "upload_piece",
      clientFolderId,
      typePiece,
      fileName,
      mimeType,
      fileBlobBase64,
    });

    if (!webhook.ok) {
      // Le fichier n'a pas atteint le Drive : on ne crée pas de fiche fantôme.
      return NextResponse.json(
        { error: `Dépôt Drive échoué : ${webhook.error ?? "inconnu"}` },
        { status: 502 },
      );
    }

    // 2. Enregistrement CRM (en attente de vérification / confirmation Drive).
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        uploaded_by: user.id,
        client_id: client?.id ?? null,
        project_id: project?.id ?? null,
        storage_bucket: "google_drive",
        storage_path: `${clientFolderId}/${fileName}`,
        document_type: documentType,
        visibility: "client",
        status: "pending_verification",
      })
      .select("id")
      .single();

    if (docError) {
      // Le fichier est bien déposé ; on signale l'échec d'enregistrement CRM.
      return NextResponse.json(
        { ok: true, warning: "Pièce déposée mais enregistrement CRM échoué", detail: docError.message },
        { status: 207 },
      );
    }

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      typePiece,
      documentType,
      status: "pending_verification",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
