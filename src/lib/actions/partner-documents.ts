"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const BUCKET = "partner-documents";
const SIGNED_URL_TTL = 60 * 5;
const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type PartnerDocument = {
  id: string;
  partner_id: string;
  contract_id: string | null;
  product_name: string;
  product_category: string;
  document_type: string;
  file_name: string | null;
  storage_path: string | null;
  drive_file_id: string | null;
  size_bytes: number | null;
  valid_until: string | null;
  created_at: string;
};

export type PartnerDocResult = { success: boolean; error?: string };

// Téléverse un document produit (CG / IPID / fiche produit…) rattaché à une offre.
export async function uploadPartnerDocument(formData: FormData): Promise<PartnerDocResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };

  const partnerId = String(formData.get("partnerId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const productName = String(formData.get("productName") ?? "").trim();
  const productCategory = String(formData.get("productCategory") ?? "autre").trim();
  const documentType = String(formData.get("documentType") ?? "autre").trim();
  const file = formData.get("file");

  if (!partnerId || !contractId) return { success: false, error: "Offre non identifiée." };
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Aucun fichier sélectionné." };
  if (file.size > MAX_SIZE) return { success: false, error: "Fichier trop volumineux (15 Mo maximum)." };
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return { success: false, error: "Format non autorisé (PDF, JPG, PNG ou WebP)." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${partnerId}/${contractId}/${documentType}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { success: false, error: "L'envoi du fichier a échoué." };

  const { error: insErr } = await supabase.from("partner_product_documents").insert({
    partner_id: partnerId,
    contract_id: contractId,
    product_name: productName || "Document",
    product_category: productCategory,
    document_type: documentType,
    file_name: file.name.slice(-160),
    storage_path: path,
    size_bytes: file.size,
    mime_type: file.type || null,
  });
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, error: "Le document n'a pas pu être enregistré." };
  }

  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: true };
}

export async function listPartnerDocuments(contractId: string): Promise<PartnerDocument[]> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("partner_product_documents")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as PartnerDocument[];
}

export async function deletePartnerDocument(docId: string, partnerId: string): Promise<PartnerDocResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };
  const { data: doc } = await supabase
    .from("partner_product_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (doc?.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path as string]);
  }
  const { error } = await supabase.from("partner_product_documents").delete().eq("id", docId);
  if (error) return { success: false, error: "Suppression impossible." };
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: true };
}

export async function getPartnerDocumentSignedUrl(docId: string): Promise<{ url?: string; error?: string }> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { error: "Service indisponible." };
  const { data: doc } = await supabase
    .from("partner_product_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc?.storage_path) return { error: "Document non téléversé (référence Drive uniquement)." };
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL);
  if (error || !data) return { error: "Lien indisponible." };
  return { url: data.signedUrl };
}
