// Règle générale de nomenclature EJ Assurances.
//   Format unifié : EJ-[ANNEE]-[RISQUE]-[SEQUENCE]   (ex. EJ-2026-SAN-0042)
//   - ANNEE   : 4 chiffres
//   - RISQUE  : code gamme sur 3 lettres (SAN, PRV, EMP, AUT, HAB, PRO, DIV)
//   - SEQUENCE: 4 chiffres, zéro-paddé
//
// Utilisé pour : préfixe de sujet d'e-mail « [Réf : …] », pied de mail de suivi,
// et parsing des références dans les webhooks d'ingestion d'e-mails.

// Regex officielle de parsing (identique à Apps Script / Gmail).
export const REFERENCE_REGEX = /EJ-\d{4}-[A-Z]{3}-\d{4}/i;

// Codes risque sur 3 lettres. Les clés couvrent les libellés courants (avec ou
// sans accents / variantes) rencontrés côté formulaire et tarificateur.
const RISK_CODES: Record<string, string> = {
  sante: "SAN",
  "mutuelle sante": "SAN",
  "complementaire sante": "SAN",
  prevoyance: "PRV",
  emprunteur: "EMP",
  "assurance emprunteur": "EMP",
  auto: "AUT",
  "assurance auto / flotte": "AUT",
  flotte: "AUT",
  habitation: "HAB",
  "assurance habitation / immeuble": "HAB",
  immeuble: "HAB",
  "multirisque pro": "PRO",
  "rc professionnelle / multirisque": "PRO",
  "rc pro": "PRO",
  professionnel: "PRO",
};

function normalizeKey(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Code risque 3 lettres à partir d'un libellé/typologie ; défaut « DIV » (divers).
export function riskCode(risk: string): string {
  const key = normalizeKey(risk);
  if (RISK_CODES[key]) return RISK_CODES[key];
  // Repli : si le libellé contient un mot-clé connu.
  for (const [label, code] of Object.entries(RISK_CODES)) {
    if (key.includes(label)) return code;
  }
  return "DIV";
}

// Construit une référence normalisée. `sequence` est zéro-paddée sur 4 chiffres.
export function buildReference(risk: string, sequence: number, year = new Date().getFullYear()): string {
  const code = riskCode(risk);
  const seq = String(Math.max(0, Math.trunc(sequence))).padStart(4, "0");
  return `EJ-${year}-${code}-${seq}`;
}

// Extrait la première référence trouvée dans un texte (sujet, corps de mail…).
export function extractReference(text: string): string | null {
  const match = String(text ?? "").match(REFERENCE_REGEX);
  return match ? match[0].toUpperCase() : null;
}

// Préfixe le sujet d'un e-mail par la référence. Idempotent : ne double pas le
// préfixe si une référence est déjà présente en tête.
export function subjectWithReference(subject: string, reference: string): string {
  const s = String(subject ?? "");
  if (REFERENCE_REGEX.test(s)) return s; // déjà référencé
  return `[Réf : ${reference}] ${s}`.trim();
}

// ── Pied de mail systématique ────────────────────────────────────────────────
export const MAIL_FOLLOWUP_TITLE = "📌 IMPORTANT – SUIVI DE VOTRE DOSSIER";

export const MAIL_FOLLOWUP_FOOTER_TEXT = `${MAIL_FOLLOWUP_TITLE}
Pour un traitement rapide, conservez la référence de votre dossier (objet de ce mail)
et rappelez-la dans tous vos échanges. Vous pouvez répondre directement à cet e-mail :
votre message est automatiquement rattaché à votre dossier.
EJ Assurances — contact@ej-assurances.fr — 01.89.31.40.29`;

export const MAIL_FOLLOWUP_FOOTER_HTML = `
<div style="margin-top:24px;padding:16px 18px;border-radius:10px;background:#F1F5F9;border:1px solid #E2E8F0;font-size:13px;line-height:1.6;color:#334155;">
  <p style="margin:0 0 6px;font-weight:700;color:#0F172A;">${MAIL_FOLLOWUP_TITLE}</p>
  <p style="margin:0;">Pour un traitement rapide, conservez la <strong>référence de votre dossier</strong>
  (indiquée en objet de ce mail) et rappelez-la dans tous vos échanges. Vous pouvez répondre
  directement à cet e-mail : votre message est automatiquement rattaché à votre dossier.</p>
  <p style="margin:8px 0 0;color:#64748B;">EJ Assurances — contact@ej-assurances.fr — 01.89.31.40.29</p>
</div>`;
