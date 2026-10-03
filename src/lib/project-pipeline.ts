// Lot technique B — modèle de pipeline dossier (couche TypeScript).
//   Miroir applicatif du champ SQL `projects.pipeline_stage` (14 étapes) et de la
//   fonction `public.is_valid_pipeline_transition`. Source de vérité métier :
//   Notion « Lot technique B — Modèle Dossier / Pipeline ».
//
//   Ne duplique pas de règle métier nouvelle : ces constantes reflètent le
//   pipeline validé. Toute évolution passe par une décision Notion + migration.

export const PIPELINE_STAGES = [
  "nouveau_a_qualifier",
  "qualification",
  "pieces_recueil_en_cours",
  "conformite_a_verifier",
  "lettre_mission",
  "demandes_devis",
  "analyse_recommandation",
  "fic_a_valider",
  "fic_envoye_signature",
  "souscription_a_lancer",
  "suivi_compagnie",
  "contrat_actif",
  "post_vente_suivi",
  "termine_archive",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  nouveau_a_qualifier: "Nouveau / à qualifier",
  qualification: "Qualification",
  pieces_recueil_en_cours: "Pièces / recueil en cours",
  conformite_a_verifier: "Conformité à vérifier",
  lettre_mission: "Lettre de mission",
  demandes_devis: "Recherche / demandes de devis",
  analyse_recommandation: "Analyse / recommandation",
  fic_a_valider: "FIC à valider",
  fic_envoye_signature: "FIC envoyé / signature en attente",
  souscription_a_lancer: "Souscription à lancer",
  suivi_compagnie: "Suivi compagnie",
  contrat_actif: "Contrat validé / actif",
  post_vente_suivi: "Post-vente / suivi",
  termine_archive: "Terminé / archivé",
};

export type QuiAgit = "agent" | "humain" | "client" | "compagnie" | "partenaire";

// Qui doit agir pour un dossier bloqué / en attente.
export const QUI_AGIT: QuiAgit[] = ["agent", "humain", "client", "compagnie", "partenaire"];

function rang(stage: PipelineStage): number {
  return PIPELINE_STAGES.indexOf(stage) + 1;
}

// Miroir exact de public.is_valid_pipeline_transition (SQL) :
// rester sur place, avancer d'au plus une étape, reculer (correction), ou
// terminer/archiver. Jamais de saut en avant.
export function isValidPipelineTransition(
  oldStage: PipelineStage | null,
  newStage: PipelineStage | null,
): boolean {
  if (newStage === null) return true;
  if (oldStage === null) return true;
  if (newStage === "termine_archive") return true;
  return rang(newStage) <= rang(oldStage) + 1;
}

// Correspondance NON ambiguë statut historique → pipeline_stage.
// Les statuts ambigus (in_progress / proposal / signed) renvoient null : ils
// nécessitent une désambiguïsation par dossier (workflow_stage + étapes) et une
// validation humaine, jamais une déduction silencieuse.
export function directPipelineStageFromStatus(status: string): PipelineStage | null {
  switch (status) {
    case "draft":
      return "nouveau_a_qualifier";
    case "qualification":
      return "qualification";
    case "waiting_documents":
      return "pieces_recueil_en_cours";
    case "closed":
      return "termine_archive";
    default:
      // in_progress | proposal | signed | sans_suite → non déterminé ici
      return null;
  }
}

export const PIPELINE_STATUTS_AMBIGUS = ["in_progress", "proposal", "signed"] as const;
