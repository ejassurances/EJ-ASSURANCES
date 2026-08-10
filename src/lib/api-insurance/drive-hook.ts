// Hook Drive — transmet les devis générés (PDF + métadonnées) au Webhook Apps
// Script pour rangement automatique dans le dossier Drive du prospect
// (« 02_Prospects_et_Recueils_Besoins »).
//
// Réutilise le webhook sécurisé du formulaire de contact (même URL + token) ;
// le champ `action` discrimine le traitement côté Apps Script.

import type { NormalizedQuote } from "./types";

const TARGET_FOLDER = "02_Prospects_et_Recueils_Besoins";

export interface DriveHookPayload {
  clientId?: string;
  prospect: { prenom?: string; nom?: string; email?: string };
  riskType: string;
  quotes: NormalizedQuote[];
}

export async function storeQuotesInDrive(
  payload: DriveHookPayload,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) return { ok: false, skipped: true, error: "CONTACT_WEBHOOK_URL non configurée" };

  const token = process.env.CONTACT_WEBHOOK_TOKEN;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(token ? { token } : {}),
        action: "store_quote",
        targetFolder: TARGET_FOLDER,
        clientId: payload.clientId ?? null,
        prospect: payload.prospect,
        riskType: payload.riskType,
        quotes: payload.quotes.map((q) => ({
          partner: q.partner,
          product: q.product,
          propositionId: q.propositionId ?? null,
          monthlyPremium: q.monthlyPremium,
          annualPremium: q.annualPremium,
          currency: q.currency,
          // Documents : lien direct (url) ou contenu Base64 des PDF (devis + IPID).
          documents: q.documents,
        })),
      }),
    });
    if (!res.ok) return { ok: false, error: `Webhook Drive HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
