import { createHmac, timingSafeEqual } from "crypto";

// Jeton signé (HMAC) pour les liens de confirmation de consentement.
// Aucun stockage : le lien est auto-vérifiable côté serveur. Secret = clé service
// Supabase (jamais exposée au client) ou CONSENT_TOKEN_SECRET si défini.
function secret(): string {
  return process.env.CONSENT_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function makeConsentToken(clientId: string): string {
  const payload = Buffer.from(clientId, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyConsentToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
