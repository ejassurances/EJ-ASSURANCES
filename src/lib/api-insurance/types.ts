// Gestionnaire d'API Tarificateurs (Insurance API Gateway) — types partagés.
//
// Contrat commun à tous les connecteurs compagnie (Néoliane, April, Generali, …)
// et format de sortie normalisé renvoyé par l'endpoint POST /api/tarification.

// Typologies de risque prises en charge par la passerelle.
export type RiskType =
  | "sante"
  | "prevoyance"
  | "emprunteur"
  | "auto"
  | "multirisque_pro";

// Données prospect. Les champs de base sont communs ; les champs spécifiques à
// un risque (régime, profession, capital, véhicule…) passent par l'index libre.
export interface ProspectData {
  civilite?: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  dateNaissance?: string; // ISO yyyy-mm-dd
  codePostal?: string;
  // Champs libres propres au risque interrogé.
  [key: string]: unknown;
}

// Requête d'entrée de l'endpoint central.
export interface TarificationRequest {
  riskType: RiskType;
  prospect: ProspectData;
  // Fiche CRM éventuelle (utilisée par le hook Drive pour ranger les devis).
  clientId?: string;
  // Restreint l'appel aux connecteurs nommés ; sinon tous ceux activés pour le risque.
  connectors?: string[];
}

// Document rattaché à un devis (devis officiel ou IPID), en lien direct ou en Base64.
export interface QuoteDocument {
  kind: "devis" | "ipid";
  filename: string;
  mimeType: string; // application/pdf
  url?: string; // lien direct si le partenaire en fournit un
  base64?: string; // sinon flux encodé
}

// Devis normalisé : format de sortie unifié (§3 des specs).
export interface NormalizedQuote {
  partner: string; // "Néoliane"
  product: string; // nom de la formule/produit
  propositionId?: string; // identifiant côté partenaire (pour récupérer le PDF)
  monthlyPremium: number | null; // prime mensuelle
  annualPremium: number | null; // prime annuelle
  currency: string; // "EUR"
  documents: QuoteDocument[]; // devis PDF + IPID
  raw?: unknown; // réponse brute du partenaire (audit/debug)
}

// Résultat d'un connecteur pour une requête (succès partiel géré par la passerelle).
export interface ConnectorResult {
  connector: string;
  ok: boolean;
  quotes: NormalizedQuote[];
  error?: string;
  durationMs: number;
}

// Interface que chaque connecteur compagnie doit implémenter.
export interface InsuranceConnector {
  id: string; // "neoliane"
  label: string; // "Néoliane"
  supports(riskType: RiskType): boolean;
  isEnabled(): boolean; // activation selon les variables d'environnement
  getQuotes(req: TarificationRequest): Promise<NormalizedQuote[]>;
}
