"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";
import { sendCrmEmail } from "@/lib/email/gmail";
import { legalSignatureHtml } from "@/lib/email/legal-signature";

export type ClientEmail = {
  id: string;
  subject: string | null;
  body: string | null;
  sender_id: string | null;
  created_at: string;
};

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Accès staff/mandataire à un client donné.
async function canManageClient(supabase: ServiceClient, user: CurrentUser, clientId: string) {
  if (user.role === "admin" || user.role === "courtier") return true;
  if (user.role === "mandataire") {
    const { data } = await supabase
      .from("clients")
      .select("id, mandataires!inner(profile_id)")
      .eq("id", clientId)
      .eq("mandataires.profile_id", user.id)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

// ── Envoyer un email à un client / prospect depuis sa fiche ──────────────────────
export async function sendClientEmailAction(input: {
  clientId: string;
  subject: string;
  body: string;
  projectId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole(["admin", "courtier", "mandataire"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { success: false, error: "Objet et message sont obligatoires." };

  if (!(await canManageClient(supabase, user, input.clientId))) {
    return { success: false, error: "Accès non autorisé à ce dossier." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id, email")
    .eq("id", input.clientId)
    .maybeSingle();
  if (!client?.email) return { success: false, error: "Ce contact n'a pas d'adresse email." };

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;">
      ${escapeHtml(body).replace(/\n/g, "<br>")}
      ${legalSignatureHtml()}
    </div>`;

  const res = await sendCrmEmail({
    to: client.email as string,
    subject,
    html,
    replyTo: user.email, // les réponses reviennent au conseiller
  });
  if (!res.success) return { success: false, error: res.error ?? "Envoi impossible." };

  // Journalisation CRM (lien client + projet éventuel).
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: (client.profile_id as string) ?? null,
    client_id: input.clientId,
    project_id: input.projectId ?? null,
    subject,
    body,
  });

  revalidatePath(`/admin/clients/${input.clientId}`);
  return { success: true };
}

// ── Historique des emails d'un client ────────────────────────────────────────────
export async function listClientEmails(clientId: string): Promise<ClientEmail[]> {
  const user = await requireRole(["admin", "courtier", "mandataire"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];
  if (!(await canManageClient(supabase, user, clientId))) return [];

  const { data } = await supabase
    .from("messages")
    .select("id, subject, body, sender_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as ClientEmail[];
}
