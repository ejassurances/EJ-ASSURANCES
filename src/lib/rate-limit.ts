// Rate-limit best-effort en mémoire (par instance).
// Suffisant pour freiner les rafales de bots sur les formulaires publics ;
// complété par honeypot + délai minimal côté action. Sur un hébergement
// serverless multi-instances, la limite est appliquée par instance chaude.

// Horodatage courant (ms). Isolé ici pour un usage en Server Component :
// le rendu a lieu une fois par requête, la valeur est donc stable pour ce rendu.
export function nowMs(): number {
  return Date.now();
}

type Hit = { count: number; resetAt: number };
const store = new Map<string, Hit>();

/**
 * Renvoie true si l'appelant a dépassé `max` requêtes sur `windowMs`.
 * @param key    Clé (ex. `contact:{ip}`).
 * @param max    Nombre d'essais autorisés sur la fenêtre.
 * @param windowMs Durée de la fenêtre en millisecondes.
 */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = store.get(key);

  if (!hit || now > hit.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  hit.count += 1;
  if (hit.count > max) return true;
  return false;
}
