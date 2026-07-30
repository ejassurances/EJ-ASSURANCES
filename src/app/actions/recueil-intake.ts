"use server";

import { headers } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { sendContactConfirmation, sendAdminNotification } from "@/lib/email/gmail";

const MIN_FILL_MS = 3000;

export type RecueilPayload = {
  product: "assurance_vie" | "prevoyance_individuelle";
  productLabel: string;
  fullName: string;
  email: string;
  phone?: string;
  answers: Record<string, string>;
  answersSummary: string;
  recontactConsent: boolean;
  partnerConsent?: boolean;
  // anti-bot
  honeypot?: string;
  renderedAt: number;
};

export type RecueilResult = { success: boolean; error?: string };

export async function submitRecueilAction(payload: RecueilPayload): Promise<RecueilResult> {
  // ── Anti-bot ──────────────────────────────────────────────────────────────
  if (payload.honeypot) return { success: true }; // honeypot rempli → no-op silencieux
  const elapsed = Date.now() - (payload.renderedAt || 0);
  if (!payload.renderedAt || elapsed < MIN_FILL_MS) return { success: true }; // trop rapide → no-op

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (isRateLimited(`recueil:${ip}`, 4, 15 * 60 * 1000)) return { success: true };

  const fullName = payload.fullName.trim();
  const email = payload.email.trim().toLowerCase();
  const phone = (payload.phone ?? "").trim();

  if (!fullName || !email || !payload.recontactConsent) {
    return { success: false, error: "Nom, email et consentement sont obligatoires." };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service temporairement indisponible." };

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://www.ej-assurances.fr";

  // Prospect QUALIFIÉ (recueil complété) → provisioning compte + fiche + recueil.
  const invite = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, phone, role: "client" },
    redirectTo: `${siteUrl}/connexion`,
  });

  let profileId = invite.data.user?.id;
  if (invite.error || !profileId) {
    const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    profileId = existing?.id;
  }

  // Emails cabinet + visiteur (best-effort, non bloquant).
  const emailJobs = Promise.allSettled([
    sendContactConfirmation({ fullName, email, phone, need: payload.productLabel, message: payload.answersSummary }),
    sendAdminNotification({
      fullName, email, phone,
      need: payload.productLabel,
      familySituation: payload.productLabel,
      urgency: "Recueil des besoins complété",
      message: payload.answersSummary,
    }),
  ]);

  if (!profileId) {
    await emailJobs;
    return { success: false, error: "invite" };
  }

  await supabase.from("profiles").upsert({
    id: profileId,
    role: "client",
    full_name: fullName,
    phone,
    compliance_status: "client_invited",
    updated_at: new Date().toISOString(),
  });

  const { data: client } = await supabase
    .from("clients")
    .upsert(
      {
        profile_id: profileId,
        full_name: fullName,
        email,
        phone,
        contact_type: "prospect",
        statut_client: "prospect",
        source_acquisition: `Recueil en ligne — ${payload.productLabel}`,
        family_context: payload.productLabel,
        notes: payload.answersSummary,
      },
      { onConflict: "profile_id" },
    )
    .select("id")
    .single();

  if (!client) {
    await emailJobs;
    return { success: false, error: "client" };
  }

  const { data: assessment } = await supabase
    .from("needs_assessments")
    .insert({
      client_id: client.id,
      created_by: profileId,
      status: "sent_to_client",
      protection_goal: payload.productLabel,
      family_context: {
        product: payload.product,
        productLabel: payload.productLabel,
        answers: payload.answers,
        source: "recueil_en_ligne",
      },
      needs_summary: payload.answersSummary,
      advisor_notes: payload.partnerConsent
        ? "Accepte le recontact cabinet et partenaires."
        : "Accepte uniquement le recontact du cabinet.",
    })
    .select("id")
    .single();

  await supabase.from("client_consents").insert([
    {
      assessment_id: assessment?.id ?? null,
      client_id: client.id,
      consent_type: "cabinet_recontact",
      consent_text: "J'accepte d'etre recontacte par EJ Assurances pour analyser ma situation.",
      accepted: true,
      accepted_at: new Date().toISOString(),
    },
    {
      assessment_id: assessment?.id ?? null,
      client_id: client.id,
      consent_type: "partner_recontact",
      consent_text: "J'accepte d'etre recontacte par EJ Assurances ou l'un de ses partenaires.",
      accepted: Boolean(payload.partnerConsent),
      accepted_at: payload.partnerConsent ? new Date().toISOString() : null,
    },
  ]);

  await emailJobs;
  return { success: true };
}
