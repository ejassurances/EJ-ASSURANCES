"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isRateLimited } from "@/lib/rate-limit";
import {
  sendContactConfirmation,
  sendAdminNotification,
} from "@/lib/email/gmail";

// Délai minimal (ms) entre le rendu du formulaire et sa soumission : en dessous,
// c'est quasi certainement un bot (aucun humain ne remplit le formulaire en < 2 s).
const MIN_FILL_MS = 2000;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function createContactIntakeAction(formData: FormData) {
  // ── Anti-bot ──────────────────────────────────────────────────────────────
  // 1. Honeypot : champ invisible ; s'il est rempli, on ignore silencieusement
  //    (on renvoie un « succès » factice pour ne pas renseigner le bot).
  if (value(formData, "company_url")) {
    redirect("/contact?success=1");
  }
  // 2. Délai minimal de remplissage.
  const renderedAt = Number(formData.get("t") ?? 0);
  const elapsed = Date.now() - renderedAt;
  if (!renderedAt || elapsed < MIN_FILL_MS) {
    redirect("/contact?success=1");
  }
  // 3. Rate-limit par IP (best-effort) : 3 envois / 10 min.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (isRateLimited(`contact:${ip}`, 3, 10 * 60 * 1000)) {
    redirect("/contact?success=1");
  }

  const fullName = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const familySituation = value(formData, "familySituation");
  const urgency = value(formData, "urgency");
  const need = value(formData, "need");
  const message = value(formData, "message");
  const recontactConsent = checked(formData, "consent");

  if (!fullName || !email || !recontactConsent) {
    redirect("/contact?error=missing");
  }

  // Contact « simple » : AUCUN compte ni fiche prospect n'est créé automatiquement
  // (décision anti faux comptes). On notifie le cabinet et on confirme au visiteur.
  // La création d'un prospect qualifié passe désormais par un recueil des besoins
  // dédié (tunnels emprunteur / assurance vie / prévoyance individuelle).
  await Promise.allSettled([
    sendContactConfirmation({ fullName, email, phone, need, message }),
    sendAdminNotification({ fullName, email, phone, need, familySituation, urgency, message }),
  ]);

  redirect("/contact?success=1");
}
