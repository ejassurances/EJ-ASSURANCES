import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { anonymiserPourIA, labelClient, logIaUsage, warnRequete } from "@/lib/ia/audit-anonymise";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return new OpenAI({ apiKey });
}

type Contract = { contract_type: string; insurer_name: string; contract_number: string; status: string; prime_annuelle: number; taux_commission: number };
type Interaction = { created_at: string; type: string; titre: string; contenu: string };
type InactiveClient = { id: string; full_name: string | null; email: string };

export async function POST(req: NextRequest) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(authUser.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { message, context, clientSearch } = await req.json();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Connexion Supabase non disponible." }, { status: 500 });

    let crmContext = "";
    // Clients dont les données personnelles sont envoyées à l'IA (pour l'audit).
    const concernedClientIds: string[] = [];

    if (context === "client" && clientSearch) {
      const clientsRes = await supabase
        .from("clients")
        .select("id, full_name, email, phone, statut_client, family_context, notes")
        .ilike("full_name", `%${clientSearch}%`)
        .limit(3);
      warnRequete("copilot/client-search", clientsRes, { warnIfEmpty: true });
      const clients = clientsRes.data;

      if (clients && clients.length > 0) {
        const client = clients[0];
        const contractsRes = await supabase
          .from("contracts")
          .select("contract_type, insurer_name, contract_number, status, prime_annuelle, taux_commission")
          .eq("client_id", client.id)
          .limit(10);
        warnRequete("copilot/contracts", contractsRes);
        const contracts = contractsRes.data;

        const interactionsRes = await supabase
          .from("interactions")
          .select("type, created_at, titre, contenu")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(5);
        warnRequete("copilot/interactions", interactionsRes);
        const interactions = interactionsRes.data;

        concernedClientIds.push(client.id);
        // Identifiants directs neutralisés ; situation familiale conservée (raisonnement).
        crmContext = `
CONTEXTE CLIENT — ${labelClient(0)}
Statut: ${client.statut_client || "N/A"} | Situation familiale: ${(client as { family_context?: string }).family_context || "N/A"}
Notes: ${anonymiserPourIA((client as { notes?: string }).notes) || "Aucune"}

CONTRATS ACTIFS (${contracts?.length || 0}):
${(contracts as Contract[] | null)?.map((c) => `- ${c.contract_type} chez ${c.insurer_name} (N°${c.contract_number}) — ${c.status} — Prime: ${c.prime_annuelle}€/an — Commission: ${c.taux_commission}%`).join("\n") || "Aucun contrat"}

DERNIÈRES INTERACTIONS:
${(interactions as Interaction[] | null)?.map((i) => `- ${new Date(i.created_at).toLocaleDateString("fr-FR")} [${i.type}]: ${anonymiserPourIA(i.titre) || "N/A"} → ${anonymiserPourIA(i.contenu) || "N/A"}`).join("\n") || "Aucune interaction"}
`;
      }
    } else {
      const { count: clientCount } = await supabase.from("clients").select("*", { count: "exact", head: true });
      const { count: contractCount } = await supabase.from("contracts").select("*", { count: "exact", head: true }).eq("status", "active");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const inactiveRes = await supabase
        .from("clients")
        .select("id, full_name, email")
        .lt("updated_at", thirtyDaysAgo.toISOString())
        .eq("statut_client", "actif")
        .limit(5);
      warnRequete("copilot/inactive-clients", inactiveRes);
      const inactiveClients = inactiveRes.data;

      const inactifs = (inactiveClients as InactiveClient[] | null) || [];
      inactifs.forEach((c) => concernedClientIds.push(c.id));

      // Noms/emails des clients inactifs neutralisés avant envoi à l'IA.
      crmContext = `
CONTEXTE CABINET EJ PARTNERS ASSURANCES
Total clients: ${clientCount || 0}
Contrats actifs: ${contractCount || 0}

CLIENTS INACTIFS RÉCENTS (>30 jours sans contact):
${inactifs.map((_, idx) => `- ${labelClient(idx)}`).join("\n") || "Aucun"}
`;
    }

    const systemPrompt = `Tu es IaGO, l'assistant IA omniscient du cabinet EJ Partners Assurances, spécialisé dans les assurances pour les familles non-traditionnelles (coparentalité, familles homoparentales, familles recomposées, LGBT+).

Tu as accès aux données CRM du cabinet. Tu réponds en français, de manière professionnelle et concise.
Tu proposes des actions concrètes (emails, notes, tâches) sous forme d'objets JSON dans ton message quand c'est pertinent.

RÈGLES IMPORTANTES:
- Tu ne prends JAMAIS d'action sans validation explicite du courtier
- Tu bases tes réponses UNIQUEMENT sur les données CRM fournies
- Si tu n'as pas assez d'informations, tu le dis clairement
- Tu utilises le format Markdown pour structurer tes réponses (** pour gras, ## pour titres, - pour listes)

${crmContext ? `DONNÉES CRM DISPONIBLES:\n${crmContext}` : ""}`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        // Le message libre du courtier peut contenir un identifiant direct saisi
        // à la main : on le passe dans le module d'anonymisation avant envoi.
        { role: "user", content: anonymiserPourIA(message) },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "Je n'ai pas pu générer une réponse.";

    // Journal d'audit : une ligne par client dont les données ont été envoyées à l'IA.
    const { data: { user } } = await supabase.auth.getUser();
    await logIaUsage(supabase, {
      actorId: user?.id ?? null,
      action: "ia.copilot",
      clientIds: concernedClientIds,
      metadata: {
        service: "openai",
        model: "gpt-4o",
        scope: context === "client" && clientSearch ? "client" : "cabinet",
        summary: "Réponse copilot IaGO générée",
      },
    });

    const actions = [];
    if (response.toLowerCase().includes("email") || response.toLowerCase().includes("envoyer")) {
      actions.push({ label: "Créer un email", type: "email", payload: response });
    }
    if (response.toLowerCase().includes("note") || response.toLowerCase().includes("noter")) {
      actions.push({ label: "Ajouter une note CRM", type: "note", payload: response });
    }
    if (response.toLowerCase().includes("relance") || response.toLowerCase().includes("rappeler")) {
      actions.push({ label: "Créer une tâche de relance", type: "task", payload: response });
    }

    return NextResponse.json({ response, actions });
  } catch (error) {
    console.error("IaGO Copilot error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la communication avec IaGO. Vérifiez que OPENAI_API_KEY est configuré sur Vercel." },
      { status: 500 }
    );
  }
}
