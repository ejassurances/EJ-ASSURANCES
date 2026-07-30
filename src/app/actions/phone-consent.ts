"use server";

import { headers } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { makeConsentToken, verifyConsentToken } from "@/lib/consent-token";
import { sendPhoneConsentRequest } from "@/lib/email/gmail";

const CONSENT_TYPE = "phone_recontact";
const CONSENT_TEXT = "J'accepte d'etre recontacte par telephone par EJ Assurances.";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://www.ej-assurances.fr"
  );
}

// ── Confirmation via lien signé (page publique) ─────────────────────────────────
export async function confirmPhoneConsentAction(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const clientId = verifyConsentToken(token);
  if (!clientId) return { success: false, error: "Lien invalide ou expiré." };

  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { success: false, error: "Contact introuvable." };

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const now = new Date().toISOString();

  // Idempotent : met à jour la ligne existante ou en crée une.
  const { data: existing } = await supabase
    .from("client_consents")
    .select("id")
    .eq("client_id", clientId)
    .eq("consent_type", CONSENT_TYPE)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("client_consents")
      .update({ accepted: true, accepted_at: now, ip_address: ip })
      .eq("id", existing.id);
  } else {
    await supabase.from("client_consents").insert({
      client_id: clientId,
      consent_type: CONSENT_TYPE,
      consent_text: CONSENT_TEXT,
      accepted: true,
      accepted_at: now,
      ip_address: ip,
    });
  }

  return { success: true };
}

// ── Campagne : envoi aux contacts sans consentement téléphone enregistré ─────────
// Idempotent : à l'envoi, on pose une ligne « en attente » (accepted=false) pour ne
// pas re-solliciter le contact aux exécutions suivantes.
export async function runPhoneConsentCampaign(
  limit = 40,
): Promise<{ sent: number; skipped: number; error?: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { sent: 0, skipped: 0, error: "Service indisponible." };

  const { data: candidates } = await supabase
    .from("clients")
    .select("id, full_name, email, contact_type, archived_at")
    .in("contact_type", ["prospect", "client"])
    .not("email", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(400);

  if (!candidates || candidates.length === 0) return { sent: 0, skipped: 0 };

  const ids = candidates.map((c) => c.id);
  const { data: consents } = await supabase
    .from("client_consents")
    .select("client_id")
    .eq("consent_type", CONSENT_TYPE)
    .in("client_id", ids);

  const already = new Set((consents ?? []).map((c) => c.client_id));
  const todo = candidates.filter((c) => !already.has(c.id)).slice(0, limit);

  let sent = 0;
  for (const c of todo) {
    const token = makeConsentToken(c.id);
    const confirmUrl = `${siteUrl()}/consentement/${token}`;
    const res = await sendPhoneConsentRequest({
      email: c.email as string,
      fullName: (c.full_name as string) || undefined,
      confirmUrl,
    });
    if (res.success) {
      // Ligne « en attente » → idempotence (skip aux prochaines exécutions).
      await supabase.from("client_consents").insert({
        client_id: c.id,
        consent_type: CONSENT_TYPE,
        consent_text: CONSENT_TEXT,
        accepted: false,
        accepted_at: null,
      });
      sent += 1;
    }
  }

  return { sent, skipped: candidates.length - todo.length };
}
