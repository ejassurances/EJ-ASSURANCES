// Passerelle de tarification — orchestrateur.
//
// Interroge en parallèle tous les connecteurs activés/compatibles avec le risque,
// agrège les devis au format normalisé, puis pousse les devis vers le Drive du
// prospect via le hook Apps Script. Un connecteur en échec n'interrompt pas les
// autres (succès partiel).

import type { ConnectorResult, NormalizedQuote, TarificationRequest } from "./types";
import { enabledConnectorsFor } from "./registry";
import { storeQuotesInDrive } from "./drive-hook";

export interface GatewayResponse {
  riskType: string;
  results: ConnectorResult[]; // détail par connecteur (statut, durée, erreurs)
  quotes: NormalizedQuote[]; // agrégat trié par prime mensuelle croissante
  drive?: { ok: boolean; skipped?: boolean; error?: string };
}

// Tri : prime mensuelle croissante, valeurs nulles en fin de liste.
function byMonthlyPremium(a: NormalizedQuote, b: NormalizedQuote): number {
  if (a.monthlyPremium == null) return 1;
  if (b.monthlyPremium == null) return -1;
  return a.monthlyPremium - b.monthlyPremium;
}

export async function runTarification(req: TarificationRequest): Promise<GatewayResponse> {
  const connectors = enabledConnectorsFor(req.riskType, req.connectors);

  const results: ConnectorResult[] = await Promise.all(
    connectors.map(async (c) => {
      const started = Date.now();
      try {
        const quotes = await c.getQuotes(req);
        return { connector: c.id, ok: true, quotes, durationMs: Date.now() - started };
      } catch (err) {
        return { connector: c.id, ok: false, quotes: [], error: String(err), durationMs: Date.now() - started };
      }
    }),
  );

  const quotes = results.flatMap((r) => r.quotes).sort(byMonthlyPremium);

  // Hook Drive : on ne pousse que s'il y a au moins un devis.
  let drive: GatewayResponse["drive"];
  if (quotes.length > 0) {
    drive = await storeQuotesInDrive({
      clientId: req.clientId,
      prospect: { prenom: req.prospect.prenom, nom: req.prospect.nom, email: req.prospect.email },
      riskType: req.riskType,
      quotes,
    });
  }

  return { riskType: req.riskType, results, quotes, drive };
}
