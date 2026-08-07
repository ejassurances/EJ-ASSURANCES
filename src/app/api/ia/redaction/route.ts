import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return new OpenAI({ apiKey });
}

const PROMPTS: Record<string, (fields: Record<string, string>) => string> = {
  email_commercial: (f) => `Rédige un email commercial professionnel et chaleureux pour présenter une solution d'assurance.
Client: ${f.nom_client || "le prospect"}
Situation familiale: ${f.situation || "non précisée"}
Produit: ${f.produit || "assurance"}
Contexte/Accroche: ${f.contexte || ""}
Ton souhaité: ${f.ton || "Professionnel et chaleureux"}

L'email doit être personnalisé, mentionner la spécificité de la situation familiale, présenter les bénéfices clés du produit et se terminer par un appel à l'action clair (prise de rendez-vous).
Longueur: 200-300 mots. Commence par "Objet:" puis le corps de l'email.`,

  reponse_objection: (f) => `Rédige une réponse professionnelle et empathique à l'objection suivante:
Objection: "${f.objection}"
Produit concerné: ${f.produit || "assurance"}
Format: ${f.format || "Email"}

La réponse doit: reconnaître l'objection, la reformuler positivement, apporter des arguments factuels, proposer une prochaine étape.`,

  courrier_resiliation: (f) => `Rédige un courrier de résiliation d'assurance conforme à la législation française.
Assuré: ${f.nom_assure}
Assureur: ${f.assureur}
N° de contrat: ${f.numero_contrat || "à compléter"}
Motif: ${f.motif || "Résiliation à échéance"}
Date d'effet souhaitée: ${f.date_effet || "à la prochaine échéance"}

Le courrier doit être formel, mentionner la base légale (${f.motif?.includes("Hamon") ? "Loi Hamon" : f.motif?.includes("Châtel") ? "Loi Châtel" : "Code des assurances"}), inclure les coordonnées de l'assuré et demander confirmation par écrit.`,

  email_relance: (f) => `Rédige un email de relance pour reprendre contact avec un client.
Client: ${f.nom_client}
Dernière interaction: ${f.derniere_interaction || "il y a quelques mois"}
Raison de la relance: ${f.raison_relance || "suivi commercial"}
Ton: ${f.ton || "Chaleureux"}

L'email doit être bref (150 mots max), rappeler le contexte sans être intrusif, apporter de la valeur et proposer un rendez-vous.`,

  note_appel: (f) => `Rédige un compte-rendu d'appel structuré et professionnel.
Client: ${f.nom_client}
Date: ${f.date_appel || "aujourd'hui"}
Points abordés: ${f.points_abordes}
Suite à donner: ${f.suite_a_donner || ""}

Format souhaité:
- Résumé de l'appel (2-3 phrases)
- Points clés abordés (liste)
- Décisions prises
- Actions à suivre avec délais
- Prochaine étape`,
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { type, fields } = await req.json();

    if (!PROMPTS[type]) {
      return NextResponse.json({ error: "Type de document non reconnu" }, { status: 400 });
    }

    const prompt = PROMPTS[type](fields);

    const systemPrompt = `Tu es IaGO, l'assistant rédactionnel du cabinet EJ Partners Assurances.
Tu rédiges des documents professionnels pour un cabinet de courtage spécialisé dans les familles non-traditionnelles (coparentalité, LGBT+, familles recomposées).
Tes textes sont toujours: sans fautes, professionnels, empathiques, adaptés au contexte familial spécifique.
Tu réponds UNIQUEMENT avec le texte du document, sans commentaire ni explication.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "Réponse vide" }, { status: 500 });

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Redaction error:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du document." }, { status: 500 });
  }
}
