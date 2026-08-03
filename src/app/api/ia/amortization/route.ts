import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logIaUsage } from "@/lib/ia/audit-anonymise";
import { computeBorrowerProjection } from "@/lib/borrower-finance";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY environment variable");
  return new OpenAI({ apiKey });
}

// Limite de taille du document envoyé à l'IA (Mo).
const MAX_SIZE = 12 * 1024 * 1024;

type ExtractedAmortization = {
  bank_name: string | null;
  loan_amount: number | null;
  annual_rate_percent: number | null;
  duration_months: number | null;
  first_payment_date: string | null;
  monthly_payment: number | null;
  current_insurer: string | null;
  current_annual_premium: number | null;
  borrower_quotity: number | null;
  co_borrower_quotity: number | null;
  confidence: number | null;
  notes: string | null;
};

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la lecture de tableaux d'amortissement et d'offres de prêt immobilier français.
On te fournit un document (tableau d'amortissement, offre de prêt ou échéancier). Tu en EXTRAIS les paramètres du crédit, sans rien inventer.
Réponds UNIQUEMENT par un objet JSON strict avec ces clés (mets null si l'information est absente du document) :
{
  "bank_name": string|null,               // banque prêteuse
  "loan_amount": number|null,             // capital emprunté initial, en euros
  "annual_rate_percent": number|null,     // taux nominal annuel du crédit, en pourcentage (ex: 3.1)
  "duration_months": number|null,         // durée totale du prêt en mois
  "first_payment_date": string|null,      // date de la 1re échéance au format YYYY-MM-DD
  "monthly_payment": number|null,         // mensualité hors assurance, en euros
  "current_insurer": string|null,         // assureur emprunteur actuel si mentionné
  "current_annual_premium": number|null,  // prime d'assurance annuelle actuelle en euros si mentionnée
  "borrower_quotity": number|null,        // quotité assurée emprunteur 1 en % (ex: 100)
  "co_borrower_quotity": number|null,     // quotité assurée emprunteur 2 en % (0 si un seul emprunteur)
  "confidence": number|null,              // ta confiance globale entre 0 et 1
  "notes": string|null                    // remarques utiles (incohérences, incertitudes)
}
Ne convertis pas les taux en décimal : garde le pourcentage. N'ajoute aucun texte hors du JSON.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Connexion Supabase non disponible." }, { status: 500 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const body = await req.json();
    const fileData: string = body?.fileData ?? ""; // data URL base64 (image ou PDF)
    const fileName: string = body?.fileName ?? "document";
    const mimeType: string = body?.mimeType ?? "";
    const bankDebitDate: string | null = body?.bankDebitDate ?? null;
    const clientId: string | null = body?.clientId ?? null;

    if (!fileData.startsWith("data:")) {
      return NextResponse.json({ error: "Document manquant ou invalide." }, { status: 400 });
    }
    // Estimation grossière de la taille du base64.
    if (fileData.length * 0.75 > MAX_SIZE) {
      return NextResponse.json({ error: "Document trop volumineux (12 Mo maximum)." }, { status: 400 });
    }

    const isPdf = mimeType.includes("pdf") || fileData.startsWith("data:application/pdf");
    const documentPart = isPdf
      ? { type: "file" as const, file: { filename: fileName, file_data: fileData } }
      : { type: "image_url" as const, image_url: { url: fileData } };

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [
            { type: "text", text: "Voici le document à analyser. Extrais les paramètres du crédit." },
            documentPart,
          ] as any,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let extracted: ExtractedAmortization;
    try {
      extracted = JSON.parse(raw) as ExtractedAmortization;
    } catch {
      return NextResponse.json({ error: "Réponse IA illisible. Réessayez avec un document plus net." }, { status: 502 });
    }

    // Quotité assurée totale (emprunteur + co-emprunteur) pour le capital assuré.
    const quotityPercent =
      (extracted.borrower_quotity ?? 0) + (extracted.co_borrower_quotity ?? 0) || null;

    const projection =
      extracted.loan_amount && extracted.duration_months
        ? computeBorrowerProjection({
            loanAmount: extracted.loan_amount,
            annualRatePercent: extracted.annual_rate_percent ?? 0,
            durationMonths: extracted.duration_months,
            firstPaymentDate: extracted.first_payment_date ?? "",
            bankDebitDate,
            quotityPercent,
            currentAnnualPremium: extracted.current_annual_premium,
          })
        : null;

    await logIaUsage(supabase, {
      actorId: user.id,
      action: "ia.amortization",
      clientIds: clientId ? [clientId] : [],
      metadata: {
        service: "openai",
        model: "gpt-4o",
        scope: "borrower",
        summary: "Extraction tableau d'amortissement + projection CRD",
      },
    });

    return NextResponse.json({ extracted, projection });
  } catch (error) {
    console.error("Amortization extraction error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du document. Vérifiez que OPENAI_API_KEY est configuré sur Vercel." },
      { status: 500 },
    );
  }
}
