"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  sendContactConfirmation,
  sendAdminNotification,
} from "@/lib/email/gmail";

const DER_PATH = "/documents/der-ej-assurances.html";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

// Transmet le lead au webhook externe (Apps Script) en parallèle du CRM.
// URL configurée côté serveur via CONTACT_WEBHOOK_URL ; si absente, on ignore
// silencieusement (le CRM reste la source de vérité). Non bloquant.
async function forwardToWebhook(payload: Record<string, string>) {
  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[contact] webhook forward échoué:", err);
  }
}

export async function createContactIntakeAction(formData: FormData) {
  // Anti-spam : honeypot (champ invisible rempli uniquement par les bots).
  if (value(formData, "company_url")) {
    redirect("/contact?success=1");
  }

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    redirect("/contact?error=configuration");
  }

  const firstName = value(formData, "firstName");
  const lastName = value(formData, "name");
  const fullName = `${firstName} ${lastName}`.trim();
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const typeAssurance = value(formData, "typeAssurance");
  const familySituation = value(formData, "familySituation");
  const urgency = value(formData, "urgency");
  // Le type d'assurance recherché devient le « besoin » exprimé côté CRM.
  const need = typeAssurance || value(formData, "need");
  const message = value(formData, "message");
  const partnerConsent = checked(formData, "partnerConsent");
  const recontactConsent = checked(formData, "consent");

  if (!fullName || !email || !phone || !typeAssurance || !recontactConsent) {
    redirect("/contact?error=missing");
  }

  // « Les deux » : on transmet le lead au webhook externe ET on alimente le CRM.
  // Le webhook part dès la validation, indépendamment du résultat du pipeline CRM.
  await forwardToWebhook({
    prenom: firstName,
    nom: lastName,
    email,
    telephone: phone,
    typeAssurance,
    message,
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://www.ej-assurances.fr";

  const invite = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      phone,
      role: "client",
    },
    redirectTo: `${siteUrl}/connexion`,
  });

  let profileId = invite.data.user?.id;

  if (invite.error || !profileId) {
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    profileId = existingUser?.id;
  }

  if (!profileId) {
    // Même sans compte Supabase, on envoie les emails de confirmation
    await Promise.allSettled([
      sendContactConfirmation({ fullName, email, phone, need, message }),
      sendAdminNotification({ fullName, email, phone, need, familySituation, urgency, message }),
    ]);
    redirect("/contact?error=invite");
  }

  await supabase.from("profiles").upsert({
    id: profileId,
    role: "client",
    full_name: fullName,
    phone,
    compliance_status: "client_invited",
    updated_at: new Date().toISOString(),
  });

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert(
      {
        profile_id: profileId,
        full_name: fullName,
        email,
        phone,
        family_context: familySituation || need,
        notes: message,
      },
      { onConflict: "profile_id" },
    )
    .select("id")
    .single();

  if (clientError || !client) {
    redirect("/contact?error=client");
  }

  const protectionPriorities = [
    checked(formData, "protectPartner") ? "partenaire" : null,
    checked(formData, "protectChildren") ? "enfants" : null,
    checked(formData, "protectSocialParent") ? "parent_social" : null,
    checked(formData, "protectHome") ? "logement" : null,
  ].filter(Boolean);

  const { data: assessment } = await supabase
    .from("needs_assessments")
    .insert({
      client_id: client.id,
      created_by: profileId,
      status: "sent_to_client",
      family_situation: familySituation,
      protection_goal: need,
      family_context: {
        familySituation,
        urgency,
        protectionPriorities,
        message,
        source: "public_contact_form",
      },
      client_objectives: protectionPriorities,
      needs_summary: `Demande publique : ${need}. Situation : ${familySituation}. Urgence : ${urgency}. Message : ${message}`,
      advisor_notes: partnerConsent
        ? "La personne accepte d'etre recontactee par le cabinet ou l'un de ses partenaires."
        : "La personne accepte uniquement un recontact par le cabinet.",
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
      accepted: partnerConsent,
      accepted_at: partnerConsent ? new Date().toISOString() : null,
    },
  ]);

  await supabase.from("documents").insert({
    owner_id: profileId,
    uploaded_by: profileId,
    client_id: client.id,
    storage_bucket: "public",
    storage_path: DER_PATH,
    document_type: "classeur_acpr_der",
    visibility: "client",
  });

  await supabase.from("messages").insert({
    sender_id: profileId,
    recipient_id: profileId,
    client_id: client.id,
    subject: "Votre espace EJ Partners Assurances",
    body: "Votre demande a ete recue. Un lien de connexion vous a ete envoye par email. Votre DER est disponible dans le Classeur ACPR.",
  });

  // ── Envoi des emails via Resend (en parallèle, non bloquant) ──
  await Promise.allSettled([
    sendContactConfirmation({ fullName, email, phone, need, message }),
    sendAdminNotification({ fullName, email, phone, need, familySituation, urgency, message }),
  ]);

  redirect("/contact?success=client-created");
}
