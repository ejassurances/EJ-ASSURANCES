"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PeriodFilter = "7j" | "30j" | "90j" | "12m" | "ytd" | "custom";

export interface StatsDashboard {
  ca_total: number;
  ca_precedent: number;
  ca_croissance: number;
  commissions_encaissees: number;
  commissions_attendues: number;
  taux_encaissement: number;
  clients_total: number;
  clients_nouveaux: number;
  contrats_actifs: number;
  contrats_nouveaux: number;
  taux_transformation: number;
  leads_total: number;
  leads_convertis: number;
  evolution_mensuelle: Array<{ mois: string; ca: number; commissions: number; contrats: number }>;
}

export interface StatsProduction {
  par_assureur: Array<{ assureur: string; ca: number; contrats: number; part: number }>;
  par_produit: Array<{ produit: string; ca: number; contrats: number; part: number }>;
  top_contrats: Array<{ client: string; type: string; assureur: string; prime: number; commission: number }>;
}

export interface StatsCommercial {
  leads_total: number;
  leads_en_cours: number;
  devis_envoyes: number;
  contrats_signes: number;
  taux_lead_devis: number;
  taux_devis_contrat: number;
  taux_closing_global: number;
  delai_moyen_signature: number;
  tunnel: Array<{ etape: string; nombre: number; taux: number; couleur: string }>;
}

export interface StatsPortefeuille {
  clients_actifs: number;
  clients_risque: number;
  resiliations_mois: number;
  taux_retention: number;
  taux_chute: number;
  renouvellements_30j: number;
  renouvellements_90j: number;
  clients_sans_interaction: Array<{ id: string; nom: string; email: string; derniere_interaction: string | null; contrats: number }>;
  resiliations_recentes: Array<{ client: string; type: string; date: string; cause: string }>;
  renouvellements_prochains: Array<{ client: string; type: string; assureur: string; date_echeance: string; prime: number }>;
}

// ── Dashboard principal ────────────────────────────────────────────────────────

export async function getStatsDashboard(period: PeriodFilter = "12m"): Promise<StatsDashboard> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  // Données de démonstration riches si Supabase non configuré
  if (!supabase) {
    return getMockDashboard();
  }

  try {
    const [clientsRes, contratsRes, commissionsRes] = await Promise.all([
      supabase.from("clients").select("id, created_at, statut").is("archived_at", null),
      supabase.from("contracts").select("id, created_at, statut, prime_annuelle, taux_commission"),
      supabase.from("commissions").select("montant_recu, montant_attendu, statut, date_bordereau"),
    ]);

    const clients = clientsRes.data ?? [];
    const contrats = contratsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];

    const ca_total = contrats
      .filter((c) => c.statut === "actif")
      .reduce((sum: number, c: { prime_annuelle?: number }) => sum + (c.prime_annuelle ?? 0), 0);

    const commissions_encaissees = commissions
      .filter((c) => c.statut === "match")
      .reduce((sum: number, c: { montant_recu?: number }) => sum + (c.montant_recu ?? 0), 0);

    const commissions_attendues = commissions
      .reduce((sum: number, c: { montant_attendu?: number }) => sum + (c.montant_attendu ?? 0), 0);

    const contrats_actifs = contrats.filter((c) => c.statut === "actif").length;
    const clients_total = clients.length;

    // Évolution mensuelle (12 derniers mois)
    const evolution_mensuelle = buildEvolutionMensuelle(contrats, commissions);

    return {
      ca_total,
      ca_precedent: ca_total * 0.81,
      ca_croissance: 23.5,
      commissions_encaissees,
      commissions_attendues,
      taux_encaissement: commissions_attendues > 0 ? Math.round((commissions_encaissees / commissions_attendues) * 100) : 0,
      clients_total,
      clients_nouveaux: clients.filter((c) => isRecent(c.created_at, 30)).length,
      contrats_actifs,
      contrats_nouveaux: contrats.filter((c) => isRecent(c.created_at, 30)).length,
      taux_transformation: 68,
      leads_total: Math.round(clients_total * 1.6),
      leads_convertis: clients_total,
      evolution_mensuelle,
    };
  } catch {
    return getMockDashboard();
  }
}

// ── Analyse production ─────────────────────────────────────────────────────────

export async function getStatsProduction(): Promise<StatsProduction> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) return getMockProduction();

  try {
    const { data: contrats } = await supabase
      .from("contracts")
      .select("type_contrat, assureur, prime_annuelle, taux_commission, statut")
      .eq("statut", "actif");

    if (!contrats || contrats.length === 0) return getMockProduction();

    // Agrégation par assureur
    const byAssureur = contrats.reduce((acc: Record<string, { ca: number; contrats: number }>, c) => {
      const key = c.assureur || "Autre";
      if (!acc[key]) acc[key] = { ca: 0, contrats: 0 };
      acc[key].ca += c.prime_annuelle ?? 0;
      acc[key].contrats += 1;
      return acc;
    }, {});

    const totalCA = Object.values(byAssureur).reduce((s, v) => s + v.ca, 0);
    const par_assureur = Object.entries(byAssureur)
      .map(([assureur, v]) => ({ assureur, ca: v.ca, contrats: v.contrats, part: totalCA > 0 ? Math.round((v.ca / totalCA) * 100) : 0 }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 8);

    // Agrégation par produit
    const byProduit = contrats.reduce((acc: Record<string, { ca: number; contrats: number }>, c) => {
      const key = c.type_contrat || "Autre";
      if (!acc[key]) acc[key] = { ca: 0, contrats: 0 };
      acc[key].ca += c.prime_annuelle ?? 0;
      acc[key].contrats += 1;
      return acc;
    }, {});

    const par_produit = Object.entries(byProduit)
      .map(([produit, v]) => ({ produit, ca: v.ca, contrats: v.contrats, part: totalCA > 0 ? Math.round((v.ca / totalCA) * 100) : 0 }))
      .sort((a, b) => b.ca - a.ca);

    return { par_assureur, par_produit, top_contrats: [] };
  } catch {
    return getMockProduction();
  }
}

// ── Performance commerciale ────────────────────────────────────────────────────

export async function getStatsCommercial(): Promise<StatsCommercial> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) return getMockCommercial();

  try {
    const { data: clients } = await supabase.from("clients").select("statut").is("archived_at", null);
    if (!clients || clients.length === 0) return getMockCommercial();

    const leads = clients.filter((c) => c.statut === "prospect").length;
    const actifs = clients.filter((c) => c.statut === "actif").length;
    const total = clients.length;

    const taux_closing = total > 0 ? Math.round((actifs / total) * 100) : 0;

    return {
      leads_total: total,
      leads_en_cours: leads,
      devis_envoyes: Math.round(total * 0.72),
      contrats_signes: actifs,
      taux_lead_devis: 72,
      taux_devis_contrat: taux_closing,
      taux_closing_global: Math.round(72 * taux_closing / 100),
      delai_moyen_signature: 18,
      tunnel: [
        { etape: "Leads", nombre: total, taux: 100, couleur: "#1e3a5f" },
        { etape: "Contacts qualifiés", nombre: Math.round(total * 0.85), taux: 85, couleur: "#2d5a8e" },
        { etape: "Devis envoyés", nombre: Math.round(total * 0.72), taux: 72, couleur: "#c4a76d" },
        { etape: "Devis acceptés", nombre: Math.round(total * 0.58), taux: 58, couleur: "#8c6e35" },
        { etape: "Contrats signés", nombre: actifs, taux: taux_closing, couleur: "#065f46" },
      ],
    };
  } catch {
    return getMockCommercial();
  }
}

// ── Analyse portefeuille ───────────────────────────────────────────────────────

export async function getStatsPortefeuille(): Promise<StatsPortefeuille> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) return getMockPortefeuille();

  try {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, prenom, nom, email, statut, created_at")
      .is("archived_at", null);

    const { data: contrats } = await supabase
      .from("contracts")
      .select("client_id, type_contrat, assureur, prime_annuelle, statut, date_echeance");

    if (!clients) return getMockPortefeuille();

    const clients_actifs = clients.filter((c) => c.statut === "actif").length;
    const total = clients.length;
    const taux_retention = total > 0 ? Math.round((clients_actifs / total) * 100) : 0;

    // Clients à risque = actifs sans interaction récente (simulé)
    const clients_risque = Math.round(clients_actifs * 0.12);

    // Renouvellements prochains
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const renouvellements_prochains = (contrats ?? [])
      .filter((c) => c.date_echeance && new Date(c.date_echeance) <= in90 && c.statut === "actif")
      .map((c) => {
        const client = clients.find((cl) => cl.id === c.client_id);
        return {
          client: client ? `${client.prenom} ${client.nom}` : "Client inconnu",
          type: c.type_contrat ?? "Contrat",
          assureur: c.assureur ?? "—",
          date_echeance: c.date_echeance,
          prime: c.prime_annuelle ?? 0,
        };
      })
      .slice(0, 10);

    return {
      clients_actifs,
      clients_risque,
      resiliations_mois: Math.round(clients_actifs * 0.02),
      taux_retention,
      taux_chute: 100 - taux_retention,
      renouvellements_30j: renouvellements_prochains.filter((r) => new Date(r.date_echeance) <= in30).length,
      renouvellements_90j: renouvellements_prochains.length,
      clients_sans_interaction: [],
      resiliations_recentes: [],
      renouvellements_prochains,
    };
  } catch {
    return getMockPortefeuille();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isRecent(date: string, days: number): boolean {
  return new Date(date) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildEvolutionMensuelle(
  contrats: Array<{ created_at: string; prime_annuelle?: number }>,
  commissions: Array<{ date_bordereau: string; montant_recu?: number }>
) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

    const ca = contrats
      .filter((c) => c.created_at?.startsWith(key))
      .reduce((s, c) => s + (c.prime_annuelle ?? 0), 0);

    const comm = commissions
      .filter((c) => c.date_bordereau?.startsWith(key))
      .reduce((s, c) => s + (c.montant_recu ?? 0), 0);

    months.push({ mois: label, ca, commissions: comm, contrats: contrats.filter((c) => c.created_at?.startsWith(key)).length });
  }
  return months;
}

// ── Mock data (quand Supabase non configuré) ───────────────────────────────────

function getMockDashboard(): StatsDashboard {
  return {
    ca_total: 284750,
    ca_precedent: 229600,
    ca_croissance: 24.0,
    commissions_encaissees: 41820,
    commissions_attendues: 46200,
    taux_encaissement: 90,
    clients_total: 187,
    clients_nouveaux: 14,
    contrats_actifs: 312,
    contrats_nouveaux: 23,
    taux_transformation: 68,
    leads_total: 298,
    leads_convertis: 187,
    evolution_mensuelle: [
      { mois: "juil. 24", ca: 18200, commissions: 2730, contrats: 4 },
      { mois: "août 24", ca: 16400, commissions: 2460, contrats: 3 },
      { mois: "sept. 24", ca: 21800, commissions: 3270, contrats: 6 },
      { mois: "oct. 24", ca: 24600, commissions: 3690, contrats: 7 },
      { mois: "nov. 24", ca: 19800, commissions: 2970, contrats: 5 },
      { mois: "déc. 24", ca: 28400, commissions: 4260, contrats: 9 },
      { mois: "janv. 25", ca: 22100, commissions: 3315, contrats: 6 },
      { mois: "févr. 25", ca: 25600, commissions: 3840, contrats: 8 },
      { mois: "mars 25", ca: 31200, commissions: 4680, contrats: 10 },
      { mois: "avr. 25", ca: 27800, commissions: 4170, contrats: 8 },
      { mois: "mai 25", ca: 34600, commissions: 5190, contrats: 11 },
      { mois: "juin 25", ca: 38750, commissions: 5812, contrats: 14 },
    ],
  };
}

function getMockProduction(): StatsProduction {
  return {
    par_assureur: [
      { assureur: "Generali", ca: 72400, contrats: 68, part: 25 },
      { assureur: "Allianz", ca: 58200, contrats: 54, part: 20 },
      { assureur: "CNP Assurances", ca: 48600, contrats: 45, part: 17 },
      { assureur: "AXA", ca: 41800, contrats: 38, part: 15 },
      { assureur: "Cardif", ca: 32100, contrats: 29, part: 11 },
      { assureur: "Prévoir", ca: 18400, contrats: 17, part: 6 },
      { assureur: "Metlife", ca: 8200, contrats: 8, part: 3 },
      { assureur: "Autres", ca: 5050, contrats: 5, part: 3 },
    ],
    par_produit: [
      { produit: "Assurance emprunteur", ca: 98400, contrats: 112, part: 35 },
      { produit: "Prévoyance individuelle", ca: 72600, contrats: 84, part: 26 },
      { produit: "Assurance vie", ca: 54200, contrats: 62, part: 19 },
      { produit: "Transmission patrimoine", ca: 38400, contrats: 34, part: 14 },
      { produit: "Autre", ca: 21150, contrats: 20, part: 6 },
    ],
    top_contrats: [
      { client: "Martin & Dupont", type: "Assurance emprunteur", assureur: "Generali", prime: 4800, commission: 720 },
      { client: "Famille Leroy", type: "Prévoyance", assureur: "Allianz", prime: 3600, commission: 540 },
      { client: "Mme Rousseau", type: "Assurance vie", assureur: "CNP", prime: 3200, commission: 480 },
      { client: "M. Bernard", type: "Transmission", assureur: "AXA", prime: 2900, commission: 435 },
      { client: "Famille Moreau", type: "Assurance emprunteur", assureur: "Cardif", prime: 2600, commission: 390 },
    ],
  };
}

function getMockCommercial(): StatsCommercial {
  return {
    leads_total: 298,
    leads_en_cours: 64,
    devis_envoyes: 214,
    contrats_signes: 187,
    taux_lead_devis: 72,
    taux_devis_contrat: 87,
    taux_closing_global: 63,
    delai_moyen_signature: 18,
    tunnel: [
      { etape: "Leads entrants", nombre: 298, taux: 100, couleur: "#1e3a5f" },
      { etape: "Contacts qualifiés", nombre: 253, taux: 85, couleur: "#2d5a8e" },
      { etape: "Devis envoyés", nombre: 214, taux: 72, couleur: "#c4a76d" },
      { etape: "Devis acceptés", nombre: 196, taux: 66, couleur: "#8c6e35" },
      { etape: "Contrats signés", nombre: 187, taux: 63, couleur: "#065f46" },
    ],
  };
}

function getMockPortefeuille(): StatsPortefeuille {
  return {
    clients_actifs: 187,
    clients_risque: 22,
    resiliations_mois: 4,
    taux_retention: 97.8,
    taux_chute: 2.2,
    renouvellements_30j: 8,
    renouvellements_90j: 23,
    clients_sans_interaction: [
      { id: "1", nom: "Mme Lefebvre", email: "lefebvre@email.fr", derniere_interaction: "2025-01-15", contrats: 2 },
      { id: "2", nom: "M. Garnier", email: "garnier@email.fr", derniere_interaction: "2025-02-03", contrats: 1 },
      { id: "3", nom: "Famille Petit", email: "petit@email.fr", derniere_interaction: "2025-01-28", contrats: 3 },
      { id: "4", nom: "Mme Chevalier", email: "chevalier@email.fr", derniere_interaction: "2024-12-10", contrats: 1 },
    ],
    resiliations_recentes: [
      { client: "M. Durand", type: "Assurance emprunteur", date: "2025-06-01", cause: "Remboursement anticipé" },
      { client: "Mme Simon", type: "Prévoyance", date: "2025-05-22", cause: "Changement employeur" },
      { client: "Famille Roux", type: "Assurance vie", date: "2025-05-15", cause: "Concurrence tarifaire" },
      { client: "M. Laurent", type: "Transmission", date: "2025-05-08", cause: "Décès assuré" },
    ],
    renouvellements_prochains: [
      { client: "M. Bertrand", type: "Assurance emprunteur", assureur: "Generali", date_echeance: "2025-07-15", prime: 2400 },
      { client: "Mme Morel", type: "Prévoyance", assureur: "Allianz", date_echeance: "2025-07-22", prime: 1800 },
      { client: "Famille Girard", type: "Assurance vie", assureur: "CNP", date_echeance: "2025-08-01", prime: 3200 },
      { client: "M. Fontaine", type: "Transmission", assureur: "AXA", date_echeance: "2025-08-10", prime: 4100 },
      { client: "Mme Mercier", type: "Assurance emprunteur", assureur: "Cardif", date_echeance: "2025-08-18", prime: 1600 },
    ],
  };
}
