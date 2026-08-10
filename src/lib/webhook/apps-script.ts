// Transmission serveur → Webhook Google Apps Script (Drive / DER / devis…).
//   URL + jeton configurés côté serveur (CONTACT_WEBHOOK_URL / CONTACT_WEBHOOK_TOKEN).
//   Le jeton est injecté en tête de payload (l'endpoint Apps Script rejette toute
//   requête sans le bon token). fetch suit la redirection 302 d'Apps Script vers
//   l'écho de contenu (réponse finale 200 « Success »).

export interface AppsScriptResult {
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
}

export async function postToAppsScript(
  payload: Record<string, unknown>,
): Promise<AppsScriptResult> {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) return { ok: false, skipped: true, error: "CONTACT_WEBHOOK_URL non configurée" };

  const token = process.env.CONTACT_WEBHOOK_TOKEN;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { token, ...payload } : payload),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `Apps Script HTTP ${res.status}` };
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
