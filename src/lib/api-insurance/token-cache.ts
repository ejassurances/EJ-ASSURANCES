// Cache in-memory des jetons d'accès partenaires (Bearer / access_token).
//
// Objectif : ne pas ré-authentifier à chaque requête. Le jeton est conservé
// jusqu'à un peu avant son expiration réelle (marge EXPIRY_SKEW_MS).
//
// ⚠️ Note prod (Vercel serverless) : la mémoire n'est pas partagée entre les
// instances/lambdas ; ce cache économise les ré-authentifications au sein d'une
// même instance chaude. Pour un cache partagé multi-instances, réimplémenter la
// même interface (get/set/clear) sur Vercel KV ou Redis — le reste du code ne
// change pas.

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const store = new Map<string, CachedToken>();

// Renouvellement anticipé : marge de sécurité avant l'expiration annoncée.
const EXPIRY_SKEW_MS = 60_000;

export function getCachedToken(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - EXPIRY_SKEW_MS) {
    store.delete(key);
    return null;
  }
  return entry.token;
}

export function setCachedToken(
  key: string,
  token: string,
  expiresInSeconds: number,
): void {
  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600;
  store.set(key, { token, expiresAt: Date.now() + ttl * 1000 });
}

export function clearCachedToken(key: string): void {
  store.delete(key);
}
