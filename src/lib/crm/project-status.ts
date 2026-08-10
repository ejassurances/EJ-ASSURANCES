// Correspondance entre les statuts « métier » émis par les workflows Drive /
// Apps Script (LEAD_NOUVEAU, LM_ENVOYEE, …) et l'enum strict de la colonne
// public.projects.status
//   ('draft','qualification','in_progress','waiting_documents','proposal',
//    'signed','closed','sans_suite').
//
// Les libellés externes ne font PAS partie de l'enum : on les mappe vers la
// valeur enum la plus proche (pour `status`) tout en conservant le libellé brut
// dans `projects.workflow_stage` (texte libre) — aucune perte d'information.

export type ProjectEnumStatus =
  | "draft"
  | "qualification"
  | "in_progress"
  | "waiting_documents"
  | "proposal"
  | "signed"
  | "closed"
  | "sans_suite";

interface StatusMapping {
  status: ProjectEnumStatus; // valeur enum écrite dans projects.status
  label: string; // libellé humain (journal d'activité / interactions)
}

const EXTERNAL_STATUS: Record<string, StatusMapping> = {
  LEAD_NOUVEAU: { status: "qualification", label: "Nouveau lead" },
  LM_ENVOYEE: { status: "in_progress", label: "Lettre de mission envoyée" },
  PIECE_DEPOSEE: { status: "waiting_documents", label: "Pièce déposée" },
  DEVOIR_CONSEIL_EMIS: { status: "proposal", label: "Devoir de conseil émis" },
};

export interface MappedProjectStatus {
  status: ProjectEnumStatus;
  workflowStage: string; // libellé brut conservé tel quel
  label: string;
}

// Renvoie la correspondance pour un statut externe, ou null si inconnu.
export function mapExternalProjectStatus(external: string): MappedProjectStatus | null {
  const key = String(external ?? "").trim().toUpperCase();
  const mapping = EXTERNAL_STATUS[key];
  if (!mapping) return null;
  return { status: mapping.status, workflowStage: key, label: mapping.label };
}

export function isKnownExternalStatus(external: string): boolean {
  return mapExternalProjectStatus(external) !== null;
}
