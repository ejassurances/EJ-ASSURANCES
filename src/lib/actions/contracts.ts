"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "./clients";

// ── Types ──────────────────────────────────────────────────────────────────────
export type ContractFormData = {
  client_id: string;
  project_id?: string;
  contract_number?: string;
  insurer_name: string;
  contract_type: string;
  status?: "draft" | "active" | "pending_signature" | "terminated" | "archived";
  effective_date?: string;
  end_date?: string;
  prime_annuelle?: number;
  prime_mensuelle?: number;
  taux_commission?: number;
  economies_realisees?: number;
  beneficiaires?: string;
  notes?: string;
};

// ── Mise à jour du compteur public d'économies ────────────────────────────────
async function incrementEconomiesEmprunteur(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, montant: number) {
  const { data: stats } = await supabase
    .from("cabinet_stats")
    .select("economies_emprunteur_euros")
    .eq("id", "singleton")
    .single();

  const current = stats?.economies_emprunteur_euros ?? 0;

  await supabase
    .from("cabinet_stats")
    .update({
      economies_emprunteur_euros: current + montant,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton");

  revalidatePath("/");
}

// ── Créer un contrat ───────────────────────────────────────────────────────────
export async function createContract(data: ContractFormData): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const montant_commission_annuel =
    data.prime_annuelle && data.taux_commission
      ? (data.prime_annuelle * data.taux_commission) / 100
      : undefined;

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      ...data,
      montant_commission_annuel,
      status: data.status ?? "draft",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Si contrat emprunteur actif avec économies renseignées → mise à jour compteur public
  if (
    data.status === "active" &&
    data.contract_type === "Assurance emprunteur" &&
    data.economies_realisees &&
    data.economies_realisees > 0
  ) {
    await incrementEconomiesEmprunteur(supabase, data.economies_realisees);
  }

  revalidatePath(`/admin/clients/${data.client_id}`);
  revalidatePath("/admin/clients");
  return { success: true, id: contract.id };
}

// ── Mettre à jour un contrat ───────────────────────────────────────────────────
export async function updateContract(
  contractId: string,
  data: Partial<ContractFormData>,
  previousStatus?: string
): Promise<ActionResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const montant_commission_annuel =
    data.prime_annuelle && data.taux_commission
      ? (data.prime_annuelle * data.taux_commission) / 100
      : undefined;

  const { error } = await supabase
    .from("contracts")
    .update({ ...data, ...(montant_commission_annuel ? { montant_commission_annuel } : {}) })
    .eq("id", contractId);

  if (error) return { success: false, error: error.message };

  // Si le contrat vient de passer à "active" et est de type emprunteur avec économies
  const justActivated = previousStatus !== "active" && data.status === "active";
  if (
    justActivated &&
    data.contract_type === "Assurance emprunteur" &&
    data.economies_realisees &&
    data.economies_realisees > 0
  ) {
    await incrementEconomiesEmprunteur(supabase, data.economies_realisees);
  }

  if (data.client_id) revalidatePath(`/admin/clients/${data.client_id}`);
  return { success: true };
}

// ── Supprimer un contrat ───────────────────────────────────────────────────────
export async function deleteContract(contractId: string, clientId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { success: false, error: "Connexion Supabase non disponible." };

  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

// ── Liste des contrats ─────────────────────────────────────────────────────────
export async function getContractsList(opts?: { clientId?: string; status?: string }) {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, insurer_name, contract_type, status,
      effective_date, end_date, prime_annuelle, taux_commission,
      montant_commission_annuel, economies_realisees, beneficiaires, notes, created_at,
      clients(id, full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (opts?.clientId) query = query.eq("client_id", opts.clientId);
  if (opts?.status && opts.status !== "Tous") query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

// ── Détail d'un contrat ────────────────────────────────────────────────────────
export async function getContract(contractId: string) {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("contracts")
    .select(`
      id, client_id, project_id, contract_number, insurer_name, contract_type, status,
      effective_date, end_date, prime_annuelle, prime_mensuelle, taux_commission,
      montant_commission_annuel, economies_realisees, beneficiaires, notes, created_at,
      clients(id, full_name, email, phone)
    `)
    .eq("id", contractId)
    .maybeSingle();

  if (error) return null;
  return data;
}
