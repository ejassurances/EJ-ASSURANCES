// Connecteur Néoliane — API Extraverse (Neoverse) v1.0.
// Doc : https://extraverse.neoliane.fr/api/docs/1.0/authentification
//
// Authentification : OAuth2 client_credentials.
//   POST {base}/oauth/token
//     body  { grant_type: "client_credentials", client_id, client_secret }
//     200   { token_type: "Bearer", expires_in, access_token }
//   Le jeton est ensuite envoyé via  Authorization: Bearer <access_token>.
//   Certains endpoints exigent aussi un "userApiKey" dans le corps de la requête
//   (Extranet > Mon Compte > Accès externes).
//
// ✅ L'authentification (authenticate) est implémentée et testée (mock).
// ⚠️ getTarifs / getDevisPdf : la charpente (auth + Bearer + normalisation) est
//    en place ; les chemins/mapping exacts des endpoints de tarification et de
//    génération de devis doivent être alignés sur les pages « Tarification » /
//    « Souscription » de la doc Extraverse. Ils sont paramétrables par env
//    (NEOLIANE_TARIF_PATH, NEOLIANE_DEVIS_PATH) pour éviter tout chemin en dur
//    non confirmé.

import type {
  InsuranceConnector,
  NormalizedQuote,
  ProspectData,
  RiskType,
  TarificationRequest,
} from "../types";
import { clearCachedToken, getCachedToken, setCachedToken } from "../token-cache";

const TOKEN_CACHE_KEY = "neoliane:access_token";

// Base API : configurable (Sandbox / Prod) via NEOLIANE_EXTRAVERSE_URL.
function baseUrl(): string {
  return (process.env.NEOLIANE_EXTRAVERSE_URL ?? "https://extraverse.neoliane.fr/api").replace(/\/+$/, "");
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NEOLIANE_CLIENT_ID;
  // Le secret peut être fourni sous NEOLIANE_CLIENT_SECRET ou NEOLIANE_API_KEY.
  const clientSecret = process.env.NEOLIANE_CLIENT_SECRET ?? process.env.NEOLIANE_API_KEY;
  if (!clientId || !clientSecret) {
    throw new Error("Néoliane : NEOLIANE_CLIENT_ID / NEOLIANE_CLIENT_SECRET (ou NEOLIANE_API_KEY) manquants.");
  }
  return { clientId, clientSecret };
}

// userApiKey requis par certains endpoints (tarification / souscription).
function userApiKey(): string | undefined {
  return process.env.NEOLIANE_USER_API_KEY ?? process.env.NEOLIANE_API_KEY;
}

export interface NeolianeAuthResult {
  token_type: string;
  expires_in: number;
  access_token: string;
}

/**
 * Récupère un Bearer Token valide (OAuth2 client_credentials).
 * Met en cache l'access_token selon `expires_in` ; renvoie le jeton en cache
 * tant qu'il est valide. `force = true` ignore le cache et ré-authentifie.
 */
export async function authenticate(force = false): Promise<string> {
  if (!force) {
    const cached = getCachedToken(TOKEN_CACHE_KEY);
    if (cached) return cached;
  }

  const { clientId, clientSecret } = credentials();

  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data: Partial<NeolianeAuthResult> & { error?: string; error_description?: string; message?: string } =
    await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || data.message || `HTTP ${res.status}`;
    throw new Error(`Néoliane : échec de l'authentification (${detail}).`);
  }

  setCachedToken(TOKEN_CACHE_KEY, data.access_token, Number(data.expires_in) || 3600);
  return data.access_token;
}

// Réinitialise le cache d'authentification (utilisé par les tests / rotation manuelle).
export function resetNeolianeAuth(): void {
  clearCachedToken(TOKEN_CACHE_KEY);
}

// Requête authentifiée : ajoute le Bearer ; en cas de 401, ré-authentifie une
// fois (le jeton a pu expirer côté serveur avant notre marge) puis rejoue.
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string) =>
    fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(await authenticate());
  if (res.status === 401) {
    res = await doFetch(await authenticate(true));
  }
  return res;
}

// ── Mapping prospect → payload Néoliane ──────────────────────────────────────
// Volontairement minimal et centralisé ; à compléter selon la doc tarification.
// ── Routage strict par gamme (isolation riskType) ────────────────────────────
// Chaque risque interroge EXCLUSIVEMENT l'endpoint de SA gamme Néoliane ; la
// réponse est ensuite filtrée pour ne conserver que les produits de cette gamme,
// actifs et autorisés sur le code courtier EJ Assurances. Aucun mélange possible.
interface GammeConfig {
  path: string; // endpoint tarification isolé (paramétrable par env)
  label: string; // libellé commercial par défaut de la gamme
  // Signatures acceptées dans la réponse (gamme / famille / produit), normalisées.
  families: string[];
}

const GAMMES: Record<"sante" | "prevoyance" | "emprunteur", GammeConfig> = {
  sante: {
    path: process.env.NEOLIANE_TARIF_PATH_SANTE ?? "/neoverse/public/sante/tarification",
    label: "Néoliane Santé",
    families: ["sante", "complementaire sante", "mutuelle"],
  },
  prevoyance: {
    path: process.env.NEOLIANE_TARIF_PATH_PREVOYANCE ?? "/neoverse/public/prevoyance/tarification",
    label: "Néoliane Prévoyance",
    families: ["prevoyance", "ij", "indemnites journalieres", "obseques", "hospitalisation"],
  },
  emprunteur: {
    path: process.env.NEOLIANE_TARIF_PATH_EMPRUNTEUR ?? "/neoverse/public/emprunteur/tarification",
    label: "Néoliane Emprunteur",
    families: ["emprunteur", "assurance emprunteur", "assurance de pret", "adp"],
  },
};

// Gammes Néoliane réellement exposées via Extraverse.
const SUPPORTED_RISKS: RiskType[] = ["sante", "prevoyance", "emprunteur"];

function gammeFor(riskType: RiskType): GammeConfig | null {
  return riskType in GAMMES ? GAMMES[riskType as keyof typeof GAMMES] : null;
}

// Normalisation pour comparaison : minuscule, sans accents, espaces compactés.
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNeolianePayload(prospect: ProspectData): Record<string, unknown> {
  return {
    // Champs libres spécifiques au risque transmis tels quels, puis les champs
    // de base normalisés, la clé API utilisateur et le code courtier.
    ...prospect,
    prenom: prospect.prenom,
    nom: prospect.nom,
    email: prospect.email,
    dateNaissance: prospect.dateNaissance,
    codePostal: prospect.codePostal,
    userApiKey: userApiKey(),
    // Restreint la tarification aux produits autorisés sur le code courtier EJ.
    codeCourtier: process.env.NEOLIANE_COURTIER_CODE,
  };
}

// Nom commercial propre : « <Gamme> - <Formule> »
// (ex. "Néoliane Emprunteur - Formule Confort").
function commercialName(p: Record<string, unknown>, gamme: GammeConfig): string {
  const gammeLabel = String(p.libelleGamme ?? p.nomGamme ?? gamme.label).trim();
  const formule = String(p.nomProduit ?? p.libelleProduit ?? p.libelle ?? p.formule ?? "").trim();
  const base = norm(gammeLabel).includes("neoliane") ? gammeLabel : `Néoliane ${gammeLabel}`;
  return formule ? `${base} - ${formule}` : base;
}

// Filtre d'intégrité : la proposition appartient-elle EXACTEMENT à la gamme
// demandée ? (fail-safe : sans aucun signal de gamme, on rejette).
function belongsToGamme(p: Record<string, unknown>, gamme: GammeConfig): boolean {
  const signals = [
    p.libelleGamme,
    p.nomGamme,
    p.gamme,
    p.famille,
    p.nomProduit,
    p.libelleProduit,
    p.libelle,
    p.riskType,
    p.type,
  ]
    .map(norm)
    .filter(Boolean);
  if (!signals.length) return false;
  return signals.some((sig) => gamme.families.some((fam) => sig.includes(fam)));
}

// Produit actif / autorisé : rejette uniquement si la réponse marque
// explicitement l'inactivité ou la non-autorisation.
function isActiveForCourtier(p: Record<string, unknown>): boolean {
  const inactive =
    p.actif === false ||
    p.isActive === false ||
    p.active === false ||
    p.autorise === false ||
    p.disabled === true ||
    norm(p.statut) === "inactif" ||
    norm(p.status) === "inactive";
  return !inactive;
}

// Normalise une proposition Néoliane vers le format de sortie unifié.
function normalizeProposition(
  p: Record<string, unknown>,
  riskType: RiskType,
  gamme: GammeConfig,
): NormalizedQuote {
  const monthly = pickNumber(p, ["cotisationMensuelle", "prime_mensuelle", "monthly"]);
  const annual =
    pickNumber(p, ["cotisationAnnuelle", "prime_annuelle", "annual"]) ??
    (monthly != null ? Math.round(monthly * 12 * 100) / 100 : null);

  return {
    partner: "Néoliane",
    product: commercialName(p, gamme),
    riskType,
    propositionId: p.id != null ? String(p.id) : p.propositionId != null ? String(p.propositionId) : undefined,
    monthlyPremium: monthly,
    annualPremium: annual,
    currency: "EUR",
    documents: [],
    raw: p,
  };
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

/**
 * Interroge l'endpoint de tarification de la gamme correspondant STRICTEMENT au
 * riskType (Santé / Prévoyance / Emprunteur). La réponse est filtrée pour ne
 * conserver que les produits de cette gamme, actifs et autorisés sur le code
 * courtier EJ Assurances, puis normalisée (nom commercial + cotisations).
 */
export async function getTarifs(
  prospectData: ProspectData,
  riskType: RiskType,
): Promise<NormalizedQuote[]> {
  const gamme = gammeFor(riskType);
  if (!gamme) {
    // Gamme non exposée par Néoliane → aucune requête (isolation stricte).
    return [];
  }

  const res = await authedFetch(gamme.path, {
    method: "POST",
    body: JSON.stringify(toNeolianePayload(prospectData)),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(`Néoliane : tarification ${riskType} échouée (${detail}).`);
  }

  const propositions: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.propositions)
      ? data.propositions
      : Array.isArray(data?.data)
        ? data.data
        : [];

  // Verrou d'intégrité : gamme exacte + actif/autorisé courtier, PUIS normalisation.
  return propositions
    .filter((p) => belongsToGamme(p, gamme) && isActiveForCourtier(p))
    .map((p) => normalizeProposition(p, riskType, gamme));
}

/**
 * Récupère le devis officiel Néoliane (PDF) pour une proposition donnée.
 * Renvoie le PDF en Base64 + le type MIME (flux binaire décodé côté appelant).
 */
export async function getDevisPdf(
  propositionId: string,
): Promise<{ filename: string; mimeType: string; base64: string }> {
  const path = (process.env.NEOLIANE_DEVIS_PATH ?? "/neoverse/public/devis/{id}/pdf").replace(
    "{id}",
    encodeURIComponent(propositionId),
  );

  const res = await authedFetch(path, { method: "GET", headers: { Accept: "application/pdf" } });
  if (!res.ok) {
    throw new Error(`Néoliane : récupération du devis PDF échouée (HTTP ${res.status}).`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    filename: `devis-neoliane-${propositionId}.pdf`,
    mimeType: "application/pdf",
    base64: buf.toString("base64"),
  };
}

// ── Implémentation de l'interface InsuranceConnector ─────────────────────────
export const neolianeConnector: InsuranceConnector = {
  id: "neoliane",
  label: "Néoliane",

  supports(riskType: RiskType): boolean {
    // Néoliane Extraverse : Santé, Prévoyance, Emprunteur (gammes isolées).
    return SUPPORTED_RISKS.includes(riskType);
  },

  isEnabled(): boolean {
    return Boolean(process.env.NEOLIANE_CLIENT_ID && (process.env.NEOLIANE_CLIENT_SECRET || process.env.NEOLIANE_API_KEY));
  },

  async getQuotes(req: TarificationRequest): Promise<NormalizedQuote[]> {
    const quotes = await getTarifs(req.prospect, req.riskType);

    // Enrichit chaque devis avec son PDF (non bloquant : un échec PDF ne perd
    // pas la proposition tarifaire).
    await Promise.all(
      quotes.map(async (q) => {
        if (!q.propositionId) return;
        try {
          const pdf = await getDevisPdf(q.propositionId);
          q.documents.push({ kind: "devis", ...pdf });
        } catch {
          // PDF indisponible : on garde la proposition sans document.
        }
      }),
    );

    return quotes;
  },
};
