// Tests — règle de nomenclature EJ (référence, parsing, préfixe sujet).

import { describe, expect, it } from "vitest";
import {
  REFERENCE_REGEX,
  buildReference,
  extractReference,
  riskCode,
  subjectWithReference,
} from "./reference";

describe("nomenclature EJ", () => {
  it("construit une référence au format EJ-[ANNEE]-[RISQUE]-[SEQUENCE]", () => {
    expect(buildReference("Mutuelle Santé", 42, 2026)).toBe("EJ-2026-SAN-0042");
    expect(buildReference("emprunteur", 7, 2026)).toBe("EJ-2026-EMP-0007");
    expect(buildReference("inconnu", 1, 2026)).toBe("EJ-2026-DIV-0001");
  });

  it("mappe les codes risque sur 3 lettres", () => {
    expect(riskCode("Prévoyance")).toBe("PRV");
    expect(riskCode("Assurance Auto / Flotte")).toBe("AUT");
    expect(riskCode("RC Professionnelle / Multirisque")).toBe("PRO");
  });

  it("extrait la référence via la regex officielle", () => {
    expect(REFERENCE_REGEX.source).toBe("EJ-\\d{4}-[A-Z]{3}-\\d{4}");
    expect(extractReference("Bonjour, votre dossier EJ-2026-san-0042 avance.")).toBe("EJ-2026-SAN-0042");
    expect(extractReference("aucune reference ici")).toBeNull();
  });

  it("préfixe le sujet sans doubler une référence existante", () => {
    expect(subjectWithReference("Votre devis", "EJ-2026-SAN-0042")).toBe(
      "[Réf : EJ-2026-SAN-0042] Votre devis",
    );
    const already = "[Réf : EJ-2026-SAN-0042] Relance";
    expect(subjectWithReference(already, "EJ-2026-SAN-0099")).toBe(already);
  });
});
