"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────────
export type ClientFormData = {
  full_name: string;
  email?: string;
  phone?: string;
  date_naissance?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  situation_familiale?: string;
  family_context?: string;
  statut_client?: "prospect" | "actif" | "en_cours" | "inactif";
  contact_type?: "prospect" | "client" | "partenaire" | "prescripteur";
  source_acquisition?: string;
  notes?: string;
  tags?: string[];
};

export type ActionResult = { success: boolean; error?: string; id?: string };
export type InviteClientActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeClientPayload(data: ClientFormData) {
  return {
    full_name: data.full_name.trim(),
    email: emptyToNull(data.email)?.toLowerCase() ?? null,
    phone: emptyToNull(data.phone),
    date_naissance: emptyToNull(data.date_naissance),
    adresse: emptyToNull(data.adresse),
    code_postal: emptyToNull(data.code_postal),
    ville: emptyToNull(data.ville),
    situation_familiale: emptyToNull(data.situation_familiale),
    family_context: emptyToNull(data.family_context),
    statut_client: data.statut_client ?? "prospect",
    contact_type: data.contact_type ?? "prospect",
    source_acquisition: emptyToNull(data.source_acquisition),
    notes: emptyToNull(data.notes),
  };
}

function formatClientError(message: string) {
  if (message.includes("invalid input syntax for type date")) {
    return "La date de naissance est invalide. Laissez le champ vide ou selectionnez une vraie date.";
  }

  if (message.includes("violates check constraint")) {
    return "Une valeur de statut ou de type de contact n'est pas acceptee par Supabase.";
  }

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Supabase refuse l'enregistrement. Verifiez que votre compte a bien le role admin ou courtier.";
  }

  if (message.includes("schema cache") || message.includes("Could not find")) {
    return "La base Supabase n'est pas synchronisee avec le code. Il faut appliquer les migrations CRM.";
  }

  return message;
}

// ── Créer un client ────────────────────────────────────────────────────────────
// Liste légère des clients pour un sélecteur (rattachement personne liée / co-assuré).
export async function listClientOptions(): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .is("archived_at", null)
    .order("full_name", { ascending: true })
    .limit(500);

  return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
}

export async function createClient(data: ClientFormData): Promise<ActionResult> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  if (!data.full_name.trim()) {
    return { success: false, error: "Le nom complet est obligatoire." };
  }

  const clientData = normalizeClientPayload(data);
  const tags = data.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      ...clientData,
      assigned_courtier_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatClientError(error.message) };

  // Insérer les tags
  if (tags.length > 0) {
    const { error: tagError } = await supabase.from("client_tags").insert(
      tags.map((tag) => ({ client_id: client.id, tag }))
    );

    if (tagError) {
      return { success: true, id: client.id, error: "La fiche client a ete creee, mais certains tags n'ont pas pu etre ajoutes." };
    }
  }

  revalidatePath("/admin/clients");
  return { success: true, id: client.id };
}

// ── Mettre à jour un client ────────────────────────────────────────────────────
export async function updateClient(clientId: string, data: ClientFormData): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  if (!data.full_name.trim()) {
    return { success: false, error: "Le nom complet est obligatoire." };
  }

  const clientData = normalizeClientPayload(data);
  const tags = data.tags?.map((tag) => tag.trim()).filter(Boolean);

  const { error } = await supabase
    .from("clients")
    .update(clientData)
    .eq("id", clientId);

  if (error) return { success: false, error: formatClientError(error.message) };

  // Remplacer les tags
  if (tags !== undefined) {
    await supabase.from("client_tags").delete().eq("client_id", clientId);
    if (tags.length > 0) {
      await supabase.from("client_tags").insert(
        tags.map((tag) => ({ client_id: clientId, tag }))
      );
    }
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { success: true };
}

// ── Supprimer un client ────────────────────────────────────────────────────────
export async function deleteClient(clientId: string): Promise<ActionResult> {
  return archiveClient(clientId, "Archivage demande depuis une ancienne action de suppression.");
}

export async function archiveClient(clientId: string, reason?: string): Promise<ActionResult> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { error } = await supabase
    .from("clients")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      archive_reason: reason?.trim() || "Archivage manuel depuis la fiche client.",
      statut_client: "inactif",
    })
    .eq("id", clientId)
    .is("archived_at", null);

  if (error) return { success: false, error: formatClientError(error.message) };

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "client.archived",
    target_table: "clients",
    target_id: clientId,
    metadata: { reason: reason ?? null },
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function archiveClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const reason = String(formData.get("archiveReason") ?? "");

  if (clientId) {
    await archiveClient(clientId, reason);
  }

  redirect("/admin/clients");
}

// ── Récupérer un client avec toutes ses données 360° ─────────────────────────
export async function inviteClientToPortalAction(
  _previousState: InviteClientActionState,
  formData: FormData,
): Promise<InviteClientActionState> {
  const actor = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceClient();

  if (!supabase || !serviceSupabase) {
    return { status: "error", message: "Configuration Supabase service manquante pour envoyer l'invitation." };
  }

  const clientId = String(formData.get("clientId") ?? "");

  if (!clientId) {
    return { status: "error", message: "Fiche client manquante." };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, full_name, email, profile_id, supabase_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    return { status: "error", message: "Client introuvable ou inaccessible." };
  }

  const email = String(client.email ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Ajoutez une adresse email sur la fiche client avant d'envoyer l'invitation." };
  }

  const fullName = String(client.full_name ?? "Client EJ Partners Assurances");
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://www.ej-assurances.fr";
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/connexion/nouveau-mot-de-passe`;

  let linkedUserId = String(client.profile_id ?? client.supabase_user_id ?? "");
  let mode: "invite" | "reset" = linkedUserId ? "reset" : "invite";

  if (linkedUserId) {
    const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) return { status: "error", message: resetError.message };
  } else {
    const { data: inviteData, error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "client",
        client_id: clientId,
        full_name: fullName,
      },
      redirectTo,
    });

    if (inviteError) {
      if (inviteError.message.toLowerCase().includes("already")) {
        mode = "reset";
        const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetError) return { status: "error", message: resetError.message };
      } else {
        return { status: "error", message: inviteError.message };
      }
    }

    linkedUserId = inviteData?.user?.id ?? "";
  }

  if (linkedUserId) {
    await serviceSupabase.from("users").upsert({ id: linkedUserId, email }, { onConflict: "id" });

    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", linkedUserId)
      .maybeSingle();

    if (!existingProfile) {
      await serviceSupabase.from("profiles").insert({
        id: linkedUserId,
        role: "client",
        full_name: fullName,
      });
    }

    await serviceSupabase
      .from("clients")
      .update({
        profile_id: linkedUserId,
        supabase_user_id: linkedUserId,
        invite_sent_at: new Date().toISOString(),
      })
      .eq("id", clientId);
  } else {
    await serviceSupabase
      .from("clients")
      .update({ invite_sent_at: new Date().toISOString() })
      .eq("id", clientId);
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: mode === "invite" ? "client.portal_invite_sent" : "client.portal_password_link_sent",
    target_table: "clients",
    target_id: clientId,
    metadata: {
      email,
      redirect_to: redirectTo,
      linked_profile_id: linkedUserId || null,
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");

  return {
    status: "success",
    message: mode === "invite" ? `Invitation envoyee a ${email}.` : `Lien d'acces envoye a ${email}.`,
  };
}

export async function getClient360(clientId: string) {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const [clientRes, tagsRes, relatedRes, interactionsRes, contractsRes, driveDocsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single(),
    supabase
      .from("client_tags")
      .select("tag")
      .eq("client_id", clientId),
    supabase
      .from("related_persons")
      .select("*")
      .eq("client_id", clientId)
      .order("type_relation"),
    supabase
      .from("interactions")
      .select("*, profiles(full_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("contracts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("drive_synced_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("detected_at", { ascending: false }),
  ]);

  if (clientRes.error) return null;

  return {
    client: clientRes.data,
    tags: (tagsRes.data ?? []).map((t) => t.tag),
    related_persons: relatedRes.data ?? [],
    interactions: interactionsRes.data ?? [],
    contracts: contractsRes.data ?? [],
    drive_documents: driveDocsRes.data ?? [],
  };
}

// ── Liste clients avec filtres ────────────────────────────────────────────────
export async function getClientsList(opts?: {
  search?: string;
  statut?: string;
  contact_type?: string;
  tag?: string;
}) {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("clients")
    .select(`
      id, full_name, email, phone, statut_client, contact_type, family_context,
      created_at, score_protection, archived_at,
      client_tags(tag),
      contracts(id, contract_type, status, insurer_name)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (opts?.search) {
    query = query.or(
      `full_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`
    );
  }
  if (opts?.statut && opts.statut !== "Tous") {
    query = query.eq("statut_client", opts.statut);
  }
  if (opts?.contact_type) {
    query = query.eq("contact_type", opts.contact_type);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}
