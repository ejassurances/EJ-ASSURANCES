"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";

const BUCKET = "client-documents";
const SIGNED_URL_TTL = 60 * 5; // 5 minutes
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type ClientDocument = {
  id: string;
  client_id: string;
  contract_id: string | null;
  project_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  label: string | null;
  doc_type: string | null;
  visible_to_client: boolean;
  uploaded_by: string | null;
  uploaded_by_role: string;
  created_at: string;
};

// Répercute un dépôt sur les exigences documentaires des projets du client :
// toute exigence « manquante » dont la clé correspond au type déposé passe « reçue ».
async function markRequirementsReceived(
  supabase: ServiceClient,
  clientId: string,
  docType: string,
  clientDocumentId: string,
  projectId: string | null,
) {
  if (!docType || docType === "other") return;

  // Périmètre : le projet visé si fourni, sinon tous les projets du client.
  let projectIds: string[] = [];
  if (projectId) {
    projectIds = [projectId];
  } else {
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", clientId);
    projectIds = (projects ?? []).map((p) => p.id as string);
  }
  if (projectIds.length === 0) return;

  await supabase
    .from("project_document_requirements")
    .update({
      status: "received",
      source: "crm_upload",
      source_metadata: { client_document_id: clientDocumentId },
      updated_at: new Date().toISOString(),
    })
    .in("project_id", projectIds)
    .eq("document_key", docType)
    .eq("status", "missing");
}

export type DocActionResult = { success: boolean; error?: string };

type Access = "staff" | "mandataire" | "client" | null;
type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

// Détermine le niveau d'accès de l'utilisateur courant sur un client donné.
async function resolveAccess(
  supabase: ServiceClient,
  user: CurrentUser,
  clientId: string,
): Promise<Access> {
  if (user.role === "admin" || user.role === "courtier") return "staff";

  if (user.role === "mandataire") {
    const { data } = await supabase
      .from("clients")
      .select("id, mandataires!inner(profile_id)")
      .eq("id", clientId)
      .eq("mandataires.profile_id", user.id)
      .maybeSingle();
    return data ? "mandataire" : null;
  }

  if (user.role === "client") {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("profile_id", user.id)
      .maybeSingle();
    return data ? "client" : null;
  }

  return null;
}

// ── Lister les pièces d'un contrat ou d'un projet ───────────────────────────────
export async function listClientDocuments(params: {
  clientId: string;
  contractId?: string;
  projectId?: string;
}): Promise<ClientDocument[]> {
  const user = await requireRole(["admin", "courtier", "mandataire", "client"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const access = await resolveAccess(supabase, user, params.clientId);
  if (!access) return [];

  let query = supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (params.contractId) query = query.eq("contract_id", params.contractId);
  if (params.projectId) query = query.eq("project_id", params.projectId);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as ClientDocument[];
  // Le client ne voit que les pièces qui lui sont destinées ou qu'il a déposées.
  if (access === "client") {
    return rows.filter((d) => d.visible_to_client || d.uploaded_by_role === "client");
  }
  return rows;
}

// ── Ajouter une pièce ────────────────────────────────────────────────────────────
export async function uploadClientDocument(formData: FormData): Promise<DocActionResult> {
  const user = await requireRole(["admin", "courtier", "mandataire", "client"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Connexion indisponible." };

  const clientId = String(formData.get("client_id") ?? "");
  const contractId = (formData.get("contract_id") as string) || null;
  const projectId = (formData.get("project_id") as string) || null;
  const label = ((formData.get("label") as string) || "").trim() || null;
  const docType = ((formData.get("doc_type") as string) || "").trim() || null;
  const file = formData.get("file");

  if (!clientId) return { success: false, error: "Client manquant." };
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Aucun fichier sélectionné." };
  if (file.size > MAX_SIZE) return { success: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return { success: false, error: "Format non autorisé (PDF, JPG, PNG ou WebP)." };
  }

  const access = await resolveAccess(supabase, user, clientId);
  if (!access) return { success: false, error: "Accès non autorisé à ce dossier." };

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const scope = contractId ? `contract/${contractId}` : projectId ? `project/${projectId}` : "general";
  const path = `${clientId}/${scope}/${crypto.randomUUID()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { success: false, error: "L'envoi du fichier a échoué." };

  const isClient = access === "client";
  const { data: inserted, error: insErr } = await supabase
    .from("client_documents")
    .insert({
      client_id: clientId,
      contract_id: contractId,
      project_id: projectId,
      file_name: file.name.slice(-160),
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      label,
      doc_type: docType,
      visible_to_client: isClient, // pièce déposée par le client → visible de lui
      uploaded_by: user.id,
      uploaded_by_role: access,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, error: "La pièce n'a pas pu être enregistrée." };
  }

  // Satisfaction automatique des exigences documentaires du projet / des projets du client.
  if (docType) {
    await markRequirementsReceived(supabase, clientId, docType, inserted.id as string, projectId);
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client");
  return { success: true };
}

// ── Basculer la visibilité client (cabinet / mandataire uniquement) ──────────────
export async function toggleClientDocumentVisibility(
  docId: string,
  visible: boolean,
): Promise<DocActionResult> {
  const user = await requireRole(["admin", "courtier", "mandataire"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Connexion indisponible." };

  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, client_id")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Pièce introuvable." };

  const access = await resolveAccess(supabase, user, doc.client_id as string);
  if (access !== "staff" && access !== "mandataire") {
    return { success: false, error: "Accès non autorisé." };
  }

  const { error } = await supabase
    .from("client_documents")
    .update({ visible_to_client: visible })
    .eq("id", docId);
  if (error) return { success: false, error: "Mise à jour impossible." };

  revalidatePath(`/admin/clients/${doc.client_id}`);
  revalidatePath("/client");
  return { success: true };
}

// ── Supprimer une pièce ──────────────────────────────────────────────────────────
export async function deleteClientDocument(docId: string): Promise<DocActionResult> {
  const user = await requireRole(["admin", "courtier", "mandataire", "client"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Connexion indisponible." };

  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, client_id, storage_path, uploaded_by, uploaded_by_role")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Pièce introuvable." };

  const access = await resolveAccess(supabase, user, doc.client_id as string);
  if (!access) return { success: false, error: "Accès non autorisé." };
  // Le client ne peut supprimer que ses propres dépôts.
  if (access === "client" && !(doc.uploaded_by === user.id && doc.uploaded_by_role === "client")) {
    return { success: false, error: "Vous ne pouvez supprimer que vos propres dépôts." };
  }

  await supabase.storage.from(BUCKET).remove([doc.storage_path as string]);
  const { error } = await supabase.from("client_documents").delete().eq("id", docId);
  if (error) return { success: false, error: "Suppression impossible." };

  // Si cette pièce satisfaisait des exigences projet, on les rebascule en « manquant ».
  await supabase
    .from("project_document_requirements")
    .update({
      status: "missing",
      source: null,
      source_metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq("source_metadata->>client_document_id", docId);

  revalidatePath(`/admin/clients/${doc.client_id}`);
  revalidatePath("/client");
  return { success: true };
}

// ── URL signée pour consulter/télécharger une pièce ──────────────────────────────
export async function getClientDocumentSignedUrl(
  docId: string,
): Promise<{ url?: string; error?: string }> {
  const user = await requireRole(["admin", "courtier", "mandataire", "client"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { error: "Connexion indisponible." };

  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, client_id, storage_path, visible_to_client, uploaded_by_role")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { error: "Pièce introuvable." };

  const access = await resolveAccess(supabase, user, doc.client_id as string);
  if (!access) return { error: "Accès non autorisé." };
  if (access === "client" && !doc.visible_to_client && doc.uploaded_by_role !== "client") {
    return { error: "Accès non autorisé." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL);
  if (error || !data) return { error: "Lien indisponible." };
  return { url: data.signedUrl };
}
