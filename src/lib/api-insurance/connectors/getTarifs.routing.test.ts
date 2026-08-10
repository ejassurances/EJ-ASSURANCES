// Mock de test — verrouillage du routage par gamme dans getTarifs (Néoliane).
//
// Valide l'isolation stricte par riskType : endpoint dédié par gamme, filtre
// d'intégrité (rejet des produits d'une autre gamme, inactifs ou non autorisés),
// et normalisation du nom commercial. global.fetch est mocké (token puis tarif).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTarifs, resetNeolianeAuth } from "./neolianeConnector";

const OK_TOKEN = { token_type: "Bearer", expires_in: 86400, access_token: "tok" };

// 1er appel = /oauth/token, 2e appel = endpoint de tarification de la gamme.
function mockAuthThenTarif(tarifBody: unknown, tarifStatus = 200) {
  return vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(OK_TOKEN), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify(tarifBody), {
        status: tarifStatus,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

const prospect = { prenom: "Jean", nom: "Dupont" };

describe("neolianeConnector.getTarifs — routage strict par gamme", () => {
  beforeEach(() => {
    resetNeolianeAuth();
    process.env.NEOLIANE_EXTRAVERSE_URL = "https://extraverse.neoliane.fr/api";
    process.env.NEOLIANE_CLIENT_ID = "id";
    process.env.NEOLIANE_CLIENT_SECRET = "secret";
    process.env.NEOLIANE_COURTIER_CODE = "EJ-001";
    delete process.env.NEOLIANE_TARIF_PATH_EMPRUNTEUR;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetNeolianeAuth();
  });

  it("interroge l'endpoint isolé de la gamme demandée (emprunteur)", async () => {
    const fetchMock = mockAuthThenTarif([
      { libelleGamme: "Assurance Emprunteur", nomProduit: "Formule Confort", cotisationMensuelle: 25 },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    await getTarifs(prospect, "emprunteur");

    const tarifUrl = fetchMock.mock.calls[1][0];
    expect(tarifUrl).toBe("https://extraverse.neoliane.fr/api/neoverse/public/emprunteur/tarification");
  });

  it("rejette tout produit d'une autre gamme (filtre d'intégrité)", async () => {
    const fetchMock = mockAuthThenTarif([
      { libelleGamme: "Assurance Emprunteur", nomProduit: "Confort", cotisationMensuelle: 25 },
      { libelleGamme: "Complémentaire Santé", nomProduit: "Santé Plus", cotisationMensuelle: 40 }, // hors gamme
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await getTarifs(prospect, "emprunteur");

    expect(quotes).toHaveLength(1);
    expect(quotes[0].riskType).toBe("emprunteur");
    expect(quotes[0].product).toContain("Emprunteur");
  });

  it("normalise le nom commercial « <Gamme> - <Formule> »", async () => {
    const fetchMock = mockAuthThenTarif([
      { libelleGamme: "Néoliane Emprunteur", nomProduit: "Formule Confort", cotisationMensuelle: 25 },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await getTarifs(prospect, "emprunteur");

    expect(quote.product).toBe("Néoliane Emprunteur - Formule Confort");
    expect(quote.monthlyPremium).toBe(25);
    expect(quote.annualPremium).toBe(300);
    expect(quote.currency).toBe("EUR");
  });

  it("écarte les produits explicitement inactifs / non autorisés", async () => {
    const fetchMock = mockAuthThenTarif([
      { libelleGamme: "Assurance Emprunteur", nomProduit: "Actif", cotisationMensuelle: 25, actif: true },
      { libelleGamme: "Assurance Emprunteur", nomProduit: "Inactif", cotisationMensuelle: 30, actif: false },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await getTarifs(prospect, "emprunteur");

    expect(quotes.map((q) => q.product)).toEqual(["Néoliane Assurance Emprunteur - Actif"]);
  });

  it("n'émet AUCUNE requête pour une gamme non exposée par Néoliane (auto)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await getTarifs(prospect, "auto");

    expect(quotes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
