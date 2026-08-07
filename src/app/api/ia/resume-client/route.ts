import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { anonymiserPourIA, ageDepuisNaissance, labelClient, logIaUsage, warnRequete } from "@/lib/ia/audit-anonymise";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return new OpenAI({ apiKey });
}

type Contract = { contract_type: string; insurer_name: string; status: string; prime_annuelle: number; effective_date: string };
type RelatedPerson = { type_relation: string; full_name: string; date_naissance: string };
type Interaction = { created_at: string; type: string; titre: string; contenu: string };

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Connexion Supabase non disponible." }, { status: 500 });

    const [clientRes, contractsRes, interactionsRes, relatedPersonsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("contracts").select("*").eq("client_id", clientId),
      supabase.from("interactions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
      supabase.from("related_persons").select("*").eq("client_id", clientId),
    ]);

    warnRequete("resume-client/client", clientRes);
    warnRequete("resume-client/contracts", contractsRes);
    warnRequete("resume-client/interactions", interactionsRes);
    warnRequete("resume-client/related_persons", relatedPersonsRes);

    const client = clientRes.data;
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const contracts = (contractsRes.data || []) as Contract[];
    const interactions = (interactionsRes.data || []) as Interaction[];
    const relatedPersons = (relatedPersonsRes.data || []) as RelatedPerson[];

    // Anonymisation avant envoi à OpenAI : les identifiants directs (nom, email,
    // téléphone, date de naissance) sont neutralisés ; l'âge et la situation
    // familiale (utiles au raisonnement, non identifiants directs) sont conservés.
    const clientAge = ageDepuisNaissance((client as { date_naissance?: string | null }).date_naissance);
    const clientData = `
CLIENT: ${labelClient(0)}
Âge: ${clientAge ?? "N/A"} | Statut: ${client.statut_client || "N/A"}
Situation familiale: ${client.family_context || "N/A"} | Situation: ${client.situation_familiale || "N/A"}
Profession: ${client.profession || "N/A"}
Notes: ${anonymiserPourIA(client.notes) || "Aucune"}

CONTRATS (${contracts.length}):
${contracts.map((c) => `- ${c.contract_type} chez ${c.insurer_name} — ${c.status} — Prime: ${c.prime_annuelle}€/an — Début: ${c.effective_date || "N/A"}`).join("\n") || "Aucun contrat"}

PERSONNES LIÉES (${relatedPersons.length}):
${relatedPersons.map((p, idx) => `- ${p.type_relation}: Proche ${idx + 1} (âge ${ageDepuisNaissance(p.date_naissance) ?? "N/A"})`).join("\n") || "Aucune"}

HISTORIQUE INTERACTIONS (${interactions.length}):
${interactions.slice(0, 8).map((i) => `- ${new Date(i.created_at).toLocaleDateString("fr-FR")} [${i.type}]: ${anonymiserPourIA(i.titre) || "N/A"} → ${anonymiserPourIA(i.contenu) || "N/A"}`).join("\n") || "Aucune interaction"}
`;

    const systemPrompt = `Tu es IaGO, l'assistant IA du cabinet EJ Partners Assurances.
Tu dois synthétiser le dossier d'un client en 5 points clés pour préparer un courtier avant un appel ou un rendez-vous.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "client_name": "Prénom Nom",
  "points": [
    {
      "titre": "Titre court du point",
      "contenu": "Explication détaillée en 2-3 phrases",
      "priorite": "haute|normale|info"
    }
  ],
  "recommandations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"],
  "ton_suggere": "Chaleureux et professionnel",
  "duree_estimee": "15-20 min"
}

Les 5 points doivent couvrir: situation actuelle, contrats en place, besoins non couverts, historique relationnel, point d'attention.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Synthétise ce dossier client:\n${clientData}` },
      ],
      max_tokens: 1200,
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "Réponse vide de l'IA" }, { status: 500 });

    const parsed = JSON.parse(content);

    // Ré-injection du vrai nom côté serveur (jamais envoyé à OpenAI).
    // full_name est un champ unique en base (pas first_name + last_name).
    parsed.client_name = client.full_name || parsed.client_name;

    // Journal d'audit : usage IA sur ce client.
    const { data: { user } } = await supabase.auth.getUser();
    await logIaUsage(supabase, {
      actorId: user?.id ?? null,
      action: "ia.resume_client",
      clientIds: [clientId],
      metadata: { service: "openai", model: "gpt-4o", summary: "Synthèse de dossier client générée" },
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Resume client error:", error);
    return NextResponse.json({ error: "Erreur lors de la génération de la synthèse." }, { status: 500 });
  }
}
