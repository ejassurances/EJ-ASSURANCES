// Types de pièces KYC proposés au niveau de la fiche client.
// La clé reprend, quand elle existe, la clé d'exigence projet (document_key)
// pour qu'un dépôt satisfasse automatiquement l'exigence correspondante.
//
// Ce module est volontairement "neutre" (pas de "use server") : la constante
// doit pouvoir être importée depuis un composant client. Un fichier "use server"
// ne peut exporter que des fonctions async — exporter une constante depuis un tel
// fichier et l'importer côté client la rend `undefined` au runtime.

export type ClientDocumentType = { value: string; label: string };

export const KYC_DOCUMENT_TYPES: ClientDocumentType[] = [
  { value: "identity", label: "Pièce d'identité (CNI, passeport)" },
  { value: "proof_of_address", label: "Justificatif de domicile" },
  { value: "rib", label: "RIB / IBAN" },
  { value: "livret_famille", label: "Livret de famille" },
  { value: "income_proof", label: "Justificatif de revenus" },
  { value: "current_insurance_certificate", label: "Contrat / notice assurance actuelle" },
  { value: "other", label: "Autre document" },
];
