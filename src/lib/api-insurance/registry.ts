// Registre des connecteurs compagnie de la passerelle de tarification.
//
// Pour ajouter un partenaire : créer `connectors/<nom>Connector.ts` implémentant
// InsuranceConnector, puis l'ajouter à ALL ci-dessous. Aucun autre changement.

import type { InsuranceConnector, RiskType } from "./types";
import { neolianeConnector } from "./connectors/neolianeConnector";

// Connecteurs déclarés. (ex. à venir : aprilConnector, generaliConnector…)
const ALL: InsuranceConnector[] = [neolianeConnector];

export function allConnectors(): InsuranceConnector[] {
  return ALL;
}

// Connecteurs activés (env) et compatibles avec le risque demandé, éventuellement
// restreints à une liste d'identifiants.
export function enabledConnectorsFor(riskType: RiskType, only?: string[]): InsuranceConnector[] {
  return ALL.filter(
    (c) => c.isEnabled() && c.supports(riskType) && (!only?.length || only.includes(c.id)),
  );
}
