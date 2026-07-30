"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ProspectDepositState = {
  status: "idle" | "success" | "error";
  message: string;
};

const BESOIN_LABELS: Record<string, string> = {
  emprunteur: "Assurance emprunteur",
  prevoyance: "Prévoyance",
  sante: "Complémentaire santé",
  auto: "Assurance auto / moto",
  habitation: "Assurance habitation",
  autre: "Autre besoin",
};

// Dépôt d'un prospect par un prescripteur.
// MVP sans nouvelle table : le prospect est enregistré comme contact « prospect »
// dans la table clients, avec l'apporteur tracé dans source_acquisition / notes.
// (Un rattachement dédié prescripteur→prospect pourra être ajouté ultérieurement
// pour alimenter les KPI de suivi.)
export async function depositProspectAction(
  _prev: ProspectDepositState,
  formData: FormData,
): Promise<ProspectDepositState> {
  const user = await requireRole(["prescripteur"]);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const besoin = String(formData.get("besoin") ?? "autre");
  const message = String(formData.get("message") ?? "").trim();

  if (!fullName) {
    return { status: "error", message: "Le nom du prospect est obligatoire." };
  }
  if (!email && !phone) {
    return { status: "error", message: "Renseignez au moins un email ou un téléphone pour être recontacté." };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { status: "error", message: "Connexion indisponible. Réessayez dans un instant." };
  }

  const besoinLabel = BESOIN_LABELS[besoin] ?? "Autre besoin";
  const notes = [
    `Prospect transmis par le prescripteur ${user.fullName} (${user.email}).`,
    `Besoin exprimé : ${besoinLabel}.`,
    message ? `Message : ${message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await supabase.from("clients").insert({
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    contact_type: "prospect",
    statut_client: "prospect",
    source_acquisition: `Prescripteur — ${user.fullName}`,
    notes,
  });

  if (error) {
    return { status: "error", message: "Le prospect n'a pas pu être transmis. Réessayez." };
  }

  return {
    status: "success",
    message: `Merci ! Le prospect « ${fullName} » a été transmis au cabinet. Vous serez informé de son avancement.`,
  };
}
