// ─────────────────────────────────────────────────────────────────────────────
// Calculs financiers déterministes pour l'assurance emprunteur.
//   L'IA se contente d'EXTRAIRE les paramètres du tableau d'amortissement ;
//   tous les montants (capital restant dû, primes restantes, capital assuré)
//   sont recalculés ici de façon déterministe — jamais par l'IA.
//
// Convention métier : pour une délégation/substitution d'assurance, la date
// d'effet du nouveau contrat = date de prélèvement prévue par la banque + 3 mois.
// ─────────────────────────────────────────────────────────────────────────────

export const DELEGATION_EFFECTIVE_OFFSET_MONTHS = 3;

export type AmortizationInputs = {
  /** Capital emprunté (montant initial du prêt). */
  loanAmount: number;
  /** Taux nominal annuel du crédit, en pourcentage (ex. 3.1 pour 3,1 %). */
  annualRatePercent: number;
  /** Durée totale du prêt, en mois. */
  durationMonths: number;
  /** Date de la 1re échéance (ISO YYYY-MM-DD). */
  firstPaymentDate: string;
};

// Normalise un taux : accepte 3.1 (%) ou 0.031 (décimal) et renvoie le décimal annuel.
function normalizeAnnualRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

/** Mensualité (hors assurance) d'un prêt amortissable classique. */
export function monthlyPayment(loanAmount: number, annualRatePercent: number, durationMonths: number): number | null {
  if (!(loanAmount > 0) || !(durationMonths > 0)) return null;
  const i = normalizeAnnualRate(annualRatePercent) / 12;
  if (i === 0) return round2(loanAmount / durationMonths);
  const factor = Math.pow(1 + i, durationMonths);
  return round2((loanAmount * i * factor) / (factor - 1));
}

/**
 * Capital restant dû après `k` échéances payées.
 * CRD_k = P·(1+i)^k − M·((1+i)^k − 1)/i   (M = mensualité, i = taux mensuel)
 */
export function remainingCapitalAfter(
  loanAmount: number,
  annualRatePercent: number,
  durationMonths: number,
  paymentsElapsed: number,
): number | null {
  if (!(loanAmount > 0) || !(durationMonths > 0)) return null;
  const k = Math.min(Math.max(Math.trunc(paymentsElapsed), 0), durationMonths);
  const i = normalizeAnnualRate(annualRatePercent) / 12;
  const M = monthlyPayment(loanAmount, annualRatePercent, durationMonths);
  if (M === null) return null;
  if (i === 0) return round2(Math.max(0, loanAmount - M * k));
  const factor = Math.pow(1 + i, k);
  const crd = loanAmount * factor - (M * (factor - 1)) / i;
  return round2(Math.max(0, crd));
}

/** Ajoute `months` mois à une date ISO (gère le débordement d'année). */
export function addMonths(dateIso: string, months: number): string | null {
  const d = parseIsoDate(dateIso);
  if (!d) return null;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return target.toISOString().slice(0, 10);
}

/** Nombre de mois entiers écoulés entre deux dates ISO (>= 0). */
export function monthsBetween(startIso: string, endIso: string): number {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (!a || !b) return 0;
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1; // mois non révolu
  return Math.max(0, months);
}

export type BorrowerProjection = {
  /** Date d'effet du contrat de délégation = date de prélèvement banque + 3 mois. */
  effectiveDate: string | null;
  monthlyPayment: number | null;
  /** Échéances payées entre la 1re échéance et la date d'effet. */
  paymentsElapsed: number;
  /** Mensualités restantes à la date d'effet. */
  remainingMonths: number;
  /** Capital restant dû à la date d'effet. */
  remainingCapitalAtEffective: number | null;
  /** Capital assuré restant = CRD × quotité (si quotité fournie). */
  insuredCapitalRemaining: number | null;
  /** Total des primes d'assurance restant à payer chez l'assureur actuel. */
  currentInsuranceRemaining: number | null;
};

/**
 * Projette le dossier emprunteur à la date d'effet de la délégation.
 * @param bankDebitDate date de prélèvement prévue par la banque (défaut : 1re échéance).
 * @param quotityPercent quotité assurée totale (ex. 100, ou 200 pour deux emprunteurs à 100 %).
 * @param currentAnnualPremium prime d'assurance annuelle actuelle (pour l'économie).
 */
export function computeBorrowerProjection(
  inputs: AmortizationInputs & {
    bankDebitDate?: string | null;
    quotityPercent?: number | null;
    currentAnnualPremium?: number | null;
  },
): BorrowerProjection {
  const { loanAmount, annualRatePercent, durationMonths, firstPaymentDate } = inputs;

  const baseDate = inputs.bankDebitDate || firstPaymentDate;
  const effectiveDate = baseDate ? addMonths(baseDate, DELEGATION_EFFECTIVE_OFFSET_MONTHS) : null;

  const paymentsElapsed =
    firstPaymentDate && effectiveDate
      ? Math.min(monthsBetween(firstPaymentDate, effectiveDate), Math.max(0, Math.trunc(durationMonths)))
      : 0;
  const remainingMonths = Math.max(0, Math.trunc(durationMonths) - paymentsElapsed);

  const remainingCapitalAtEffective = remainingCapitalAfter(
    loanAmount,
    annualRatePercent,
    durationMonths,
    paymentsElapsed,
  );

  const quotity = inputs.quotityPercent && inputs.quotityPercent > 0 ? inputs.quotityPercent : null;
  const insuredCapitalRemaining =
    remainingCapitalAtEffective !== null && quotity !== null
      ? round2((remainingCapitalAtEffective * quotity) / 100)
      : null;

  const currentInsuranceRemaining =
    inputs.currentAnnualPremium && inputs.currentAnnualPremium > 0
      ? round2((inputs.currentAnnualPremium * remainingMonths) / 12)
      : null;

  return {
    effectiveDate,
    monthlyPayment: monthlyPayment(loanAmount, annualRatePercent, durationMonths),
    paymentsElapsed,
    remainingMonths,
    remainingCapitalAtEffective,
    insuredCapitalRemaining,
    currentInsuranceRemaining,
  };
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
