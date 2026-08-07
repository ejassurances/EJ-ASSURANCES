import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { labelClient, logIaUsage, warnRequete } from "@/lib/ia/audit-anonymise";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return new OpenAI({ apiKey });
}

type ClientRow = { id: string; full_name: string | null; email: string; family_context: string | null; situation_familiale: string | null; statut_client: string };
type ContractRow = { client_id: string; contract_type: string; status: string };
type Opportunity = { opportunites: { potentiel_ca: string }[] };

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Connexion Supabase non disponible." }, { status: 500 });

    const clientsRes = await supabase
      .from("clients")
      .select("id, full_name, email, family_context, situation_familiale, statut_client")
      .in("statut_client", ["actif", "prospect"])
      .limit(50);
    warnRequete("cross-selling/clients", clientsRes, { warnIfEmpty: true });
    const clients = clientsRes.data;

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        total_clients: 0,
        opportunites_detectees: 0,
        ca_potentiel_total: "0 €",
        opportunities: [],
      });
    }

    const clientIds = (clients as ClientRow[]).map((c) => c.id);
    const contractsRes = await supabase
      .from("contracts")
      .select("client_id, contract_type, status")
      .in("client_id", clientIds)
      .eq("status", "active");
    warnRequete("cross-selling/contracts", contractsRes);
    const allContracts = contractsRes.data;

    // Table de correspondance conservée côté serveur uniquement (jamais envoyée à
    // OpenAI) pour ré-injecter le vrai nom / email dans la réponse.
    const realById = new Map<string, { name: string; email: string }>();

    const clientsData = (clients as ClientRow[]).map((client, index) => {
      const clientContracts = ((allContracts || []) as ContractRow[]).filter((c) => c.client_id === client.id);
      realById.set(client.id, {
        name: client.full_name?.trim() || "",
        email: client.email,
      });
      // Envoyé à OpenAI : identifiants directs neutralisés (nom → étiquette, pas
      // d'email) ; l'id (non identifiant direct) est conservé pour le mapping ;
      // la situation familiale utile au raisonnement est conservée.
      return {
        id: client.id,
        nom: labelClient(index),
        situation: client.family_context || client.situation_familiale || "Non précisé",
        contrats: clientContracts.map((c) => c.contract_type),
      };
    });

    const systemPrompt = `Tu es IaGO, l'IA d'analyse commerciale du cabinet EJ Partners Assurances.
Tu dois analyser le portefeuille clients et identifier les opportunités de cross-selling.

Les produits disponibles sont: Assurance emprunteur, Prévoyance, Transmission/Succession, Mutuelle, Assurance vie, Protection juridique.

Pour chaque client avec des opportunités, génère une analyse. Réponds UNIQUEMENT en JSON valide:
{
  "opportunities": [
    {
      "client_id": "uuid",
      "client_name": "Prénom Nom",
      "email": "email",
      "score": 85,
      "situation": "Famille homoparentale",
      "contrats_actifs": ["Assurance emprunteur"],
      "opportunites": [
        {
          "produit": "Prévoyance",
          "raison": "Famille avec enfants sans protection en cas d'arrêt de travail",
          "priorite": "haute",
          "potentiel_ca": "~800€/an"
        }
      ],
      "action_recommandee": "Proposer un bilan prévoyance complet lors du prochain contact"
    }
  ]
}

Le score (0-100) représente l'urgence/potentiel: 80+ = très prioritaire, 60-79 = prioritaire, <60 = à surveiller.
Inclure seulement les clients avec au moins une opportunité réelle. Maximum 20 clients.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyse ce portefeuille de ${clients.length} clients:\n${JSON.stringify(clientsData, null, 2)}`,
        },
      ],
      max_tokens: 3000,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "Réponse vide de l'IA" }, { status: 500 });

    const parsed = JSON.parse(content);
    const opportunities: Opportunity[] = parsed.opportunities || [];

    // Ré-injection du vrai nom / email côté serveur (jamais envoyés à OpenAI).
    (opportunities as unknown as { client_id?: string; client_name?: string; email?: string }[]).forEach((opp) => {
      const real = opp.client_id ? realById.get(opp.client_id) : undefined;
      if (real) {
        opp.client_name = real.name || opp.client_name;
        opp.email = real.email || opp.email;
      }
    });

    let totalCA = 0;
    opportunities.forEach((opp) => {
      opp.opportunites.forEach((op) => {
        const match = op.potentiel_ca.match(/(\d+)/);
        if (match) totalCA += parseInt(match[1]);
      });
    });

    // Journal d'audit : une ligne par client dont les données ont été envoyées à l'IA.
    const { data: { user } } = await supabase.auth.getUser();
    await logIaUsage(supabase, {
      actorId: user?.id ?? null,
      action: "ia.cross_selling",
      clientIds: (clients as ClientRow[]).map((c) => c.id),
      metadata: { service: "openai", model: "gpt-4o", summary: "Scan cross-selling du portefeuille", clients_count: clients.length },
    });

    return NextResponse.json({
      total_clients: clients.length,
      opportunites_detectees: opportunities.reduce((acc, o) => acc + o.opportunites.length, 0),
      ca_potentiel_total: `${totalCA.toLocaleString("fr-FR")} €`,
      opportunities,
    });
  } catch (error) {
    console.error("Cross-selling error:", error);
    return NextResponse.json({ error: "Erreur lors du scan du portefeuille." }, { status: 500 });
  }
}
