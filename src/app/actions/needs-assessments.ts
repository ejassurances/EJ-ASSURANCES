"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NeedsAssessmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  assessmentId?: string;
};

const riskDefinitions = [
  {
    key: "heirsMismatch",
    category: "succession",
    label: "Ecart entre volonté du client et héritiers légaux",
    explanation: "La famille héritière probable ne correspond pas totalement à la famille affective déclarée.",
  },
  {
    key: "socialParent",
    category: "parentalite",
    label: "Parent social ou enfant social non reconnu",
    explanation: "Une personne importante dans la cellule familiale pourrait ne pas disposer de droits suffisants.",
  },
  {
    key: "unprotectedHome",
    category: "logement",
    label: "Logement insuffisamment protégé",
    explanation: "Le logement ou le crédit associé nécessite une analyse de protection dédiée.",
  },
  {
    key: "incomeDependency",
    category: "revenus",
    label: "Personnes dépendantes des revenus du client",
    explanation: "Le décès, l'arrêt de travail ou l'invalidité pourrait fragiliser le foyer.",
  },
];

function has(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function computeScore(formData: FormData) {
  const selectedRisks = riskDefinitions.filter((risk) => has(formData, risk.key));
  const legalStatus = String(formData.get("legalStatus") ?? "");
  const riskCount = selectedRisks.length + (legalStatus !== "Mariage" ? 1 : 0);

  return {
    score: Math.max(18, 100 - riskCount * 14),
    selectedRisks,
  };
}

function numericValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function integerValue(formData: FormData, key: string) {
  const value = numericValue(formData, key);
  return value === null ? null : Math.trunc(value);
}

type ServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type RecueilClient = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  date_naissance: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
} | null;

// Alimente le pipeline Assurance Emprunteur dédié depuis un recueil des besoins.
//   - Réutilise le dossier emprunteur existant du client (tunnel ou recueil antérieur),
//     sinon en crée un, déjà rattaché au client (client_id + converted_at renseignés).
//   - Enregistre le crédit à assurer, rattaché à l'assessment source pour rester idempotent
//     (une nouvelle soumission du même recueil ne crée pas de doublon de crédit).
async function syncEmprunteurDossierFromRecueil(
  supabase: ServerClient,
  params: {
    assessmentId: string;
    clientId: string;
    client: RecueilClient;
    mortgageProject: string;
    bankName: string | null;
    loanAmount: number | null;
    loanDurationMonths: number | null;
    currentInsurer: string | null;
    currentAnnualPremium: number | null;
  },
): Promise<void> {
  const { assessmentId, clientId, client, mortgageProject } = params;

  // 1. Dossier : réutiliser celui du client s'il existe, sinon le créer.
  const { data: existingDossier } = await supabase
    .from("emprunteur_dossiers")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  let dossierId = existingDossier?.id ?? null;

  if (!dossierId) {
    const { data: created, error: dossierError } = await supabase
      .from("emprunteur_dossiers")
      .insert({
        full_name: client?.full_name ?? "Client",
        email: client?.email ?? "",
        phone: client?.phone ?? null,
        date_naissance: client?.date_naissance ?? null,
        adresse: client?.adresse ?? null,
        code_postal: client?.code_postal ?? null,
        ville: client?.ville ?? null,
        status: "draft",
        notes_prospect: "Créé automatiquement depuis le recueil des besoins.",
        source: "recueil",
        client_id: clientId,
        converted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dossierError || !created) return;
    dossierId = created.id;
  }

  // 2. Crédit à assurer : remplacer un éventuel crédit déjà issu de ce recueil (idempotence).
  await supabase.from("emprunteur_credits").delete().eq("source_assessment_id", assessmentId);

  const monthlyPremium =
    params.currentAnnualPremium === null ? null : Math.round((params.currentAnnualPremium / 12) * 100) / 100;

  await supabase.from("emprunteur_credits").insert({
    dossier_id: dossierId,
    type_bien: mortgageProject,
    banque: params.bankName,
    montant_emprunte: params.loanAmount,
    duree_mois: params.loanDurationMonths,
    assureur_actuel: params.currentInsurer,
    prime_actuelle_mensuelle: monthlyPremium,
    source_assessment_id: assessmentId,
  });
}

export async function createNeedsAssessmentAction(
  _previousState: NeedsAssessmentActionState,
  formData: FormData,
): Promise<NeedsAssessmentActionState> {
  const user = await requireRole(["admin", "courtier", "mandataire", "client"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase n'est pas encore configuré pour enregistrer le recueil.",
    };
  }

  let clientId = String(formData.get("clientId") ?? "");
  const familySituation = String(formData.get("familySituation") ?? "");
  const legalStatus = String(formData.get("legalStatus") ?? "");
  const protectionGoal = String(formData.get("protectionGoal") ?? "");
  const mortgageProject = String(formData.get("mortgageProject") ?? "");
  const borrowerDocumentsReady =
    has(formData, "loanOfferReceived") &&
    has(formData, "amortizationScheduleReceived") &&
    has(formData, "identityReceived");

  if (user.role === "client" && !clientId) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).maybeSingle();
    clientId = client?.id ?? "";
  }

  if (!clientId) {
    return {
      status: "error",
      message: "Choisis d'abord la fiche client concernée par ce recueil.",
    };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, mandataire_id, full_name, email, phone, date_naissance, adresse, code_postal, ville")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return {
      status: "error",
      message: "Fiche client introuvable ou inaccessible avec tes droits actuels.",
    };
  }

  const mandataireId =
    user.role === "mandataire"
      ? (
          await supabase
            .from("mandataires")
            .select("id")
            .eq("profile_id", user.id)
            .maybeSingle()
        ).data?.id
      : client.mandataire_id;

  const { score, selectedRisks } = computeScore(formData);

  const { data: assessment, error } = await supabase
    .from("needs_assessments")
    .insert({
      client_id: clientId,
      created_by: user.id,
      assigned_to: user.role === "client" ? null : user.id,
      mandataire_id: mandataireId ?? null,
      status: "draft",
      family_situation: familySituation,
      legal_status: legalStatus,
      protection_goal: protectionGoal,
      family_context: {
        familySituation,
        legalStatus,
        heirsMismatch: has(formData, "heirsMismatch"),
        socialParent: has(formData, "socialParent"),
        unprotectedHome: has(formData, "unprotectedHome"),
        incomeDependency: has(formData, "incomeDependency"),
      },
      needs_summary: `Situation : ${familySituation}, ${legalStatus}. Objectif : ${protectionGoal}. Projet emprunteur : ${mortgageProject}.`,
      family_protection_score: score,
      advisor_notes: String(formData.get("advisorNotes") ?? ""),
    })
    .select("id")
    .single();

  if (error || !assessment) {
    return {
      status: "error",
      message: error?.message ?? "Impossible d'enregistrer le recueil.",
    };
  }

  if (mortgageProject !== "Aucun projet immédiat") {
    await supabase.from("borrower_insurance_requests").insert({
      assessment_id: assessment.id,
      loan_type: mortgageProject,
      bank_name: String(formData.get("bankName") ?? "") || null,
      loan_amount: numericValue(formData, "loanAmount"),
      loan_duration_months: integerValue(formData, "loanDurationMonths"),
      borrowers_count: integerValue(formData, "borrowersCount"),
      insured_quotities: {
        borrower_one: integerValue(formData, "borrowerOneQuotity"),
        borrower_two: integerValue(formData, "borrowerTwoQuotity"),
      },
      current_insurer: String(formData.get("currentInsurer") ?? "") || null,
      current_annual_premium: numericValue(formData, "currentAnnualPremium"),
      requested_guarantees: ["Décès", "PTIA", "ITT", "IPT"],
      delegation_or_substitution: mortgageProject.includes("Substitution") ? "substitution" : "delegation",
    });

    // Alimente le pipeline Assurance Emprunteur dédié (emprunteur_dossiers / emprunteur_credits)
    // pour que le projet remonte dans /admin/emprunteur et sur la fiche client.
    await syncEmprunteurDossierFromRecueil(supabase, {
      assessmentId: assessment.id,
      clientId,
      client,
      mortgageProject,
      bankName: String(formData.get("bankName") ?? "") || null,
      loanAmount: numericValue(formData, "loanAmount"),
      loanDurationMonths: integerValue(formData, "loanDurationMonths"),
      currentInsurer: String(formData.get("currentInsurer") ?? "") || null,
      currentAnnualPremium: numericValue(formData, "currentAnnualPremium"),
    });

    if (!borrowerDocumentsReady) {
      await supabase.from("risk_findings").insert({
        assessment_id: assessment.id,
        risk_category: "documents_emprunteur",
        risk_label: "Pieces emprunteur obligatoires manquantes",
        risk_score: 85,
        severity: "high",
        explanation: "Le recueil emprunteur ne peut pas etre valide sans offre de pret, tableau d'amortissement et piece d'identite.",
        consequence: "Bloquer la validation metier et demander les pieces via email, espace client ou import Gmail.",
        detected_by: "workflow",
      });
    }
  }

  if (selectedRisks.length > 0) {
    await supabase.from("risk_findings").insert(
      selectedRisks.map((risk) => ({
        assessment_id: assessment.id,
        risk_category: risk.category,
        risk_label: risk.label,
        risk_score: 80,
        severity: "high",
        explanation: risk.explanation,
        consequence: "A valider avec le client puis à intégrer dans la recommandation DDA.",
        detected_by: "advisor",
      })),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/emprunteur");
  revalidatePath("/admin/family-protection-os/recueil");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/mandataire");
  revalidatePath("/mandataire/recueil-besoins");
  revalidatePath(`/mandataire/clients/${clientId}`);
  revalidatePath("/client/diagnostic-familial");

  return {
    status: "success",
    message: "Recueil enregistré et rattaché à la fiche client.",
    assessmentId: assessment.id,
  };
}
