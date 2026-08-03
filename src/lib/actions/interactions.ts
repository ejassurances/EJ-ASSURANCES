"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "./clients";

// ── Ajouter une interaction ────────────────────────────────────────────────────
export async function createInteraction(data: {
  client_id: string;
  contract_id?: string;
  type: "appel" | "email" | "rdv" | "visio" | "note" | "document" | "sms";
  titre: string;
  contenu?: string;
  duree_minutes?: number;
}): Promise<ActionResult> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { data: interaction, error } = await supabase
    .from("interactions")
    .insert({ ...data, author_id: user.id })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${data.client_id}`);
  return { success: true, id: interaction.id };
}

// ── Supprimer une interaction ──────────────────────────────────────────────────
export async function deleteInteraction(interactionId: string, clientId: string): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

// ── Ajouter une personne liée ──────────────────────────────────────────────────
export async function createRelatedPerson(data: {
  client_id: string;
  type_relation: "conjoint" | "enfant" | "parent_social" | "co_parent" | "autre";
  full_name: string;
  date_naissance?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { data: person, error } = await supabase
    .from("related_persons")
    .insert(data)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${data.client_id}`);
  return { success: true, id: person.id };
}

// Ajout d'une personne liée en la reliant à une fiche client :
//  - mode "existing" : on relie un client déjà au portefeuille (sélection) ;
//  - mode "create"   : on crée une nouvelle fiche client puis on la relie.
// Dans les deux cas, related_persons.linked_client_id pointe vers la fiche.
export async function addRelatedPersonAction(data: {
  client_id: string;
  type_relation: string;
  mode: "existing" | "create";
  existing_client_id?: string;
  full_name?: string;
  date_naissance?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<ActionResult> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  let linkedClientId: string;
  let fullName: string | null;
  let email: string | null | undefined;
  let phone: string | null | undefined;
  let dob: string | null | undefined;

  if (data.mode === "existing") {
    if (!data.existing_client_id) return { success: false, error: "Sélectionnez un client à relier." };
    const { data: c } = await supabase
      .from("clients")
      .select("id, full_name, email, phone, date_naissance")
      .eq("id", data.existing_client_id)
      .maybeSingle();
    if (!c) return { success: false, error: "Client introuvable." };
    linkedClientId = c.id as string;
    fullName = (c.full_name as string) ?? null;
    email = (c.email as string) ?? null;
    phone = (c.phone as string) ?? null;
    dob = (c.date_naissance as string) ?? null;
  } else {
    if (!data.full_name?.trim()) return { success: false, error: "Le nom est obligatoire." };
    const { data: newClient, error: cErr } = await supabase
      .from("clients")
      .insert({
        full_name: data.full_name.trim(),
        email: data.email || null,
        phone: data.phone || null,
        date_naissance: data.date_naissance || null,
        contact_type: "client",
        statut_client: "actif",
        assigned_courtier_id: user.id,
      })
      .select("id")
      .single();
    if (cErr || !newClient) return { success: false, error: cErr?.message ?? "Création de la fiche impossible." };
    linkedClientId = newClient.id as string;
    fullName = data.full_name.trim();
    email = data.email || null;
    phone = data.phone || null;
    dob = data.date_naissance || null;
  }

  const { data: person, error } = await supabase
    .from("related_persons")
    .insert({
      client_id: data.client_id,
      type_relation: data.type_relation,
      full_name: fullName,
      email,
      phone,
      date_naissance: dob,
      notes: data.notes || null,
      linked_client_id: linkedClientId,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${data.client_id}`);
  revalidatePath(`/admin/clients/${linkedClientId}`);
  revalidatePath("/admin/clients");
  return { success: true, id: person.id };
}

// ── Mettre à jour une personne liée ───────────────────────────────────────────
export async function updateRelatedPerson(
  personId: string,
  clientId: string,
  data: Partial<{
    type_relation: string;
    full_name: string;
    date_naissance: string;
    email: string;
    phone: string;
    notes: string;
  }>
): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { error } = await supabase
    .from("related_persons")
    .update(data)
    .eq("id", personId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

// ── Supprimer une personne liée ────────────────────────────────────────────────
export async function deleteRelatedPerson(personId: string, clientId: string): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { error } = await supabase.from("related_persons").delete().eq("id", personId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}
