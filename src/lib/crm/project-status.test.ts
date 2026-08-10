// Tests — mapping statut métier (Drive/Apps Script) → enum projects.status.
// Garantit qu'aucun statut mappé ne viole l'enum Postgres.

import { describe, expect, it } from "vitest";
import { mapExternalProjectStatus } from "./project-status";

const ENUM_VALUES = [
  "draft",
  "qualification",
  "in_progress",
  "waiting_documents",
  "proposal",
  "signed",
  "closed",
  "sans_suite",
];

describe("mapExternalProjectStatus", () => {
  it("mappe chaque statut métier vers une valeur enum valide", () => {
    for (const ext of ["LEAD_NOUVEAU", "LM_ENVOYEE", "PIECE_DEPOSEE", "DEVOIR_CONSEIL_EMIS"]) {
      const m = mapExternalProjectStatus(ext);
      expect(m).not.toBeNull();
      expect(ENUM_VALUES).toContain(m!.status);
      expect(m!.workflowStage).toBe(ext); // libellé brut conservé
      expect(m!.label.length).toBeGreaterThan(0);
    }
  });

  it("est insensible à la casse et aux espaces", () => {
    expect(mapExternalProjectStatus("  lead_nouveau ")!.status).toBe("qualification");
  });

  it("renvoie null pour un statut inconnu", () => {
    expect(mapExternalProjectStatus("FOO_BAR")).toBeNull();
    expect(mapExternalProjectStatus("")).toBeNull();
  });

  it("applique les correspondances attendues", () => {
    expect(mapExternalProjectStatus("LEAD_NOUVEAU")!.status).toBe("qualification");
    expect(mapExternalProjectStatus("LM_ENVOYEE")!.status).toBe("in_progress");
    expect(mapExternalProjectStatus("PIECE_DEPOSEE")!.status).toBe("waiting_documents");
    expect(mapExternalProjectStatus("DEVOIR_CONSEIL_EMIS")!.status).toBe("proposal");
  });
});
