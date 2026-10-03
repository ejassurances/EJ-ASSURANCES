// Tests — modèle de pipeline dossier (Lot technique B).

import { describe, expect, it } from "vitest";
import {
  PIPELINE_STAGES,
  directPipelineStageFromStatus,
  isValidPipelineTransition,
} from "./project-pipeline";

describe("pipeline dossier — Lot B", () => {
  it("expose les 14 étapes canoniques dans l'ordre", () => {
    expect(PIPELINE_STAGES).toHaveLength(14);
    expect(PIPELINE_STAGES[0]).toBe("nouveau_a_qualifier");
    expect(PIPELINE_STAGES[13]).toBe("termine_archive");
  });

  it("mappe les statuts NON ambigus et renvoie null pour les ambigus", () => {
    expect(directPipelineStageFromStatus("draft")).toBe("nouveau_a_qualifier");
    expect(directPipelineStageFromStatus("qualification")).toBe("qualification");
    expect(directPipelineStageFromStatus("waiting_documents")).toBe("pieces_recueil_en_cours");
    expect(directPipelineStageFromStatus("closed")).toBe("termine_archive");
    // ambigus / hors pipeline → null (désambiguïsation humaine requise)
    expect(directPipelineStageFromStatus("in_progress")).toBeNull();
    expect(directPipelineStageFromStatus("proposal")).toBeNull();
    expect(directPipelineStageFromStatus("signed")).toBeNull();
    expect(directPipelineStageFromStatus("sans_suite")).toBeNull();
  });

  it("autorise sur-place, +1, recul, et terminé ; refuse un saut avant", () => {
    expect(isValidPipelineTransition("qualification", "qualification")).toBe(true); // sur place
    expect(isValidPipelineTransition("qualification", "pieces_recueil_en_cours")).toBe(true); // +1
    expect(isValidPipelineTransition("demandes_devis", "qualification")).toBe(true); // recul
    expect(isValidPipelineTransition("qualification", "termine_archive")).toBe(true); // clôture
    expect(isValidPipelineTransition("qualification", "souscription_a_lancer")).toBe(false); // saut avant
    expect(isValidPipelineTransition(null, "contrat_actif")).toBe(true); // init
  });
});
