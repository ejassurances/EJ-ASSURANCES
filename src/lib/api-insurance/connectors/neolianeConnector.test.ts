// Mock de test — authentification Néoliane (OAuth2 client_credentials).
//
// Valide : succès + parsing du jeton, mise en cache selon expires_in, renvoi du
// jeton en cache (pas de 2ᵉ appel réseau), ré-authentification forcée, envoi du
// bon corps/endpoint, et gestion des erreurs (identifiants manquants,
// invalid_client). Aucun appel réseau réel : global.fetch est mocké.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate, resetNeolianeAuth } from "./neolianeConnector";

const OK_TOKEN = {
  token_type: "Bearer",
  expires_in: 86400,
  access_token: "test-access-token-123",
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: ok ? status : status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("neolianeConnector.authenticate", () => {
  beforeEach(() => {
    resetNeolianeAuth();
    process.env.NEOLIANE_EXTRAVERSE_URL = "https://extraverse.neoliane.fr/api";
    process.env.NEOLIANE_CLIENT_ID = "client-id-test";
    process.env.NEOLIANE_CLIENT_SECRET = "client-secret-test";
    delete process.env.NEOLIANE_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetNeolianeAuth();
  });

  it("récupère et renvoie l'access_token (OAuth2 client_credentials)", async () => {
    const fetchMock = mockFetchOnce(OK_TOKEN);
    vi.stubGlobal("fetch", fetchMock);

    const token = await authenticate();

    expect(token).toBe("test-access-token-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Bon endpoint + bon corps.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://extraverse.neoliane.fr/api/oauth/token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      grant_type: "client_credentials",
      client_id: "client-id-test",
      client_secret: "client-secret-test",
    });
  });

  it("met le jeton en cache : un 2ᵉ appel ne re-frappe pas le réseau", async () => {
    const fetchMock = mockFetchOnce(OK_TOKEN);
    vi.stubGlobal("fetch", fetchMock);

    const t1 = await authenticate();
    const t2 = await authenticate();

    expect(t1).toBe(t2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // servi depuis le cache
  });

  it("ré-authentifie quand force = true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(OK_TOKEN), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...OK_TOKEN, access_token: "second-token" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const t1 = await authenticate();
    const t2 = await authenticate(true);

    expect(t1).toBe("test-access-token-123");
    expect(t2).toBe("second-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepte NEOLIANE_API_KEY comme secret de repli", async () => {
    delete process.env.NEOLIANE_CLIENT_SECRET;
    process.env.NEOLIANE_API_KEY = "api-key-fallback";
    const fetchMock = mockFetchOnce(OK_TOKEN);
    vi.stubGlobal("fetch", fetchMock);

    await authenticate();

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).client_secret).toBe("api-key-fallback");
  });

  it("échoue proprement si les identifiants sont absents", async () => {
    delete process.env.NEOLIANE_CLIENT_ID;
    delete process.env.NEOLIANE_CLIENT_SECRET;
    delete process.env.NEOLIANE_API_KEY;
    const fetchMock = mockFetchOnce(OK_TOKEN);
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticate()).rejects.toThrow(/NEOLIANE_CLIENT_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propage l'erreur invalid_client de l'API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: "invalid_client", error_description: "Client authentication failed" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticate()).rejects.toThrow(/Client authentication failed/);
  });
});
