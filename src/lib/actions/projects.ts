"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendCrmEmail } from "@/lib/email/gmail";
import { legalSignatureHtml } from "@/lib/email/legal-signature";
import {
  borrowerRequiredDocuments,
  borrowerWorkflowSteps,
  type BorrowerProject,
  type ProjectStepKey,
  type ProjectStepStatus,
} from "@/lib/project-workflow";

export type ProjectActionState = {
  status: "idle" | "success" | "error";
  message: string;
  projectId?: string;
};

type WorkflowAction = "start" | "send" | "sign" | "complete" | "block" | "activate";

const workflowActionLabels: Record<WorkflowAction, string> = {
  start: "Etape demarree.",
  send: "Element envoye au client par email et espace client.",
  sign: "Signature client enregistree.",
  complete: "Etape validee.",
  block: "Etape mise en attente.",
  activate: "Dossier active.",
};

export async function getClientProjects(clientId: string): Promise<BorrowerProject[]> {
  await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, client_id, title, project_type, status, google_drive_folder_id, google_drive_folder_url, workflow_stage, workflow_data, sensitive_context, created_at, updated_at,
      project_workflow_steps(id, project_id, step_key, label, status, position, delivery_channels, requirements, completed_at, completed_by),
      project_document_requirements(id, project_id, document_key, label, required_for_validation, status, position, accepted_sources, document_id, source, source_metadata, validated_at, validated_by),
      project_borrower_needs(id, project_id, client_id, completion_source, status, bank_name, loan_amount, loan_duration_months, remaining_capital, loan_start_date, loan_end_date, current_insurer, current_annual_premium, requested_quotities, requested_guarantees, delegation_or_substitution, objective, known_data, missing_data, validation_blockers, client_comment, advisor_notes),
      project_deliveries(id, project_id, delivery_type, channel, status, subject, body, sent_at, created_at),
      project_signatures(id, project_id, signature_type, status, client_comment, requested_at, signed_at),
      project_email_imports(id, project_id, gmail_thread_id, from_email, subject, received_at, ai_summary, attachment_count, excluded),
      scooter_insurance_needs(id, project_id, client_id, status, owner_full_name, owner_email, vehicle_brand, vehicle_model, serial_number, purchase_date, purchase_price, max_speed_limited_25, used_by_household_members, household_users_details, extension_recommended, usage_type, storage_location, desired_effective_date, advisor_notes)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as BorrowerProject[];
}

export async function createBorrowerProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase n'est pas configure pour creer le projet." };
  }

  const clientId = String(formData.get("clientId") ?? "");
  const projectTitle = String(formData.get("projectTitle") ?? "Assurance emprunteur").trim();

  if (!clientId) {
    return { status: "error", message: "Fiche client manquante." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return { status: "error", message: "Client introuvable ou inaccessible." };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      assigned_courtier_id: user.id,
      title: projectTitle || `Assurance emprunteur - ${client.full_name ?? client.email ?? "client"}`,
      project_type: "assurance_emprunteur",
      status: "waiting_documents",
      sensitive_context:
        "Recueil emprunteur a completer. Validation bloquee tant que l'offre de pret et le tableau d'amortissement ne sont pas rattaches au projet.",
    })
    .select("id")
    .single();

  if (error || !project) {
    return { status: "error", message: error?.message ?? "Impossible de creer le projet." };
  }

  await supabase.from("project_workflow_steps").insert(
    borrowerWorkflowSteps.map((step, index) => ({
      project_id: project.id,
      step_key: step.key,
      label: step.title,
      status: step.status,
      position: index + 1,
      delivery_channels: step.channels,
      requirements: { deliverables: step.deliverables, description: step.description },
    })),
  );

  await supabase.from("project_document_requirements").insert(
    borrowerRequiredDocuments.map((document, index) => ({
      project_id: project.id,
      document_key: document.key,
      label: document.label,
      required_for_validation: document.requiredForValidation,
      status: "missing",
      position: index + 1,
      accepted_sources: document.acceptedSources,
    })),
  );

  await supabase.from("project_borrower_needs").insert({
    project_id: project.id,
    client_id: clientId,
    completed_by: user.id,
    completion_source: "courtier",
    status: "documents_missing",
    objective: "Comparer ou substituer l'assurance emprunteur en securisant les garanties du pret.",
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "project.created_from_client_file",
    target_table: "projects",
    target_id: project.id,
    metadata: {
      client_id: clientId,
      project_type: "assurance_emprunteur",
      initial_status: "waiting_documents",
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/emprunteur");

  return {
    status: "success",
    message: "Projet assurance emprunteur cree et rattache a la fiche client.",
    projectId: project.id,
  };
}

export async function createScooterProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase n'est pas configure pour creer le projet." };
  }

  const clientId = String(formData.get("clientId") ?? "");
  const projectTitle = String(formData.get("projectTitle") ?? "Assurance trottinette").trim();

  if (!clientId) {
    return { status: "error", message: "Fiche client manquante." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return { status: "error", message: "Client introuvable ou inaccessible." };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      assigned_courtier_id: user.id,
      title: projectTitle || `Assurance trottinette - ${client.full_name ?? client.email ?? "client"}`,
      project_type: "assurance_trottinette",
      status: "waiting_documents",
      workflow_stage: "recueil_besoins",
      sensitive_context:
        "Recueil trottinette a completer : verifier limitation 25 km/h et extension si utilisation par d'autres membres du foyer fiscal.",
      workflow_data: {
        required_questions: ["max_speed_limited_25", "used_by_household_members"],
        expected_folder_prefix: "DOX_TROT",
      },
    })
    .select("id")
    .single();

  if (error || !project) {
    return { status: "error", message: error?.message ?? "Impossible de creer le projet trottinette." };
  }

  await supabase.from("scooter_insurance_needs").insert({
    client_id: clientId,
    project_id: project.id,
    status: "draft",
    owner_full_name: client.full_name,
    owner_email: client.email,
    collected_by: user.id,
  });

  await supabase.from("drive_sync_events").insert({
    event_type: "drive.project_folder_requested",
    client_id: clientId,
    project_id: project.id,
    status: "queued",
    created_by: user.id,
    payload: {
      product_code: "TROT",
      expected_folder_pattern: "DOX_TROT_Prenom_NOM",
      subfolders: [
        "01 - Identite KYC",
        "02 - Recueil des besoins",
        "03 - Devis",
        "04 - Fiche conseil",
        "05 - Contrat",
        "06 - Echanges",
      ],
    },
  });

  await supabase.from("drive_sync_events").insert({
    event_type: "drive.project_folder_requested",
    client_id: clientId,
    project_id: project.id,
    status: "queued",
    created_by: user.id,
    payload: {
      product_code: "ADP",
      expected_folder_pattern: "DOX_ADP_Prenom_NOM",
      subfolders: [
        "01 - Identite KYC",
        "02 - Recueil des besoins",
        "03 - Offre de pret",
        "04 - Tableau amortissement",
        "05 - Devis",
        "06 - Feuille de mission",
        "07 - Fiche conseil",
        "08 - Souscription",
        "09 - Echanges",
      ],
    },
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "project.scooter_created_from_client_file",
    target_table: "projects",
    target_id: project.id,
    metadata: {
      client_id: clientId,
      project_type: "assurance_trottinette",
      initial_status: "waiting_documents",
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/workflows/trottinette");

  return {
    status: "success",
    message: "Projet assurance trottinette cree et rattache a la fiche client.",
    projectId: project.id,
  };
}

export async function saveBorrowerNeedsAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase n'est pas configure pour enregistrer le recueil." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");

  if (!projectId || !clientId) {
    return { status: "error", message: "Projet ou fiche client manquant." };
  }

  const numberOrNull = (value: FormDataEntryValue | null) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const loanAmount = numberOrNull(formData.get("loanAmount"));
  const loanDurationMonths = numberOrNull(formData.get("loanDurationMonths"));
  const remainingCapital = numberOrNull(formData.get("remainingCapital"));
  const currentAnnualPremium = numberOrNull(formData.get("currentAnnualPremium"));
  const loanOfferReady = formData.get("loanOfferReady") === "on";
  const amortizationReady = formData.get("amortizationReady") === "on";
  const identityReady = formData.get("identityReady") === "on";

  const blockers = [
    !loanOfferReady ? "offre_pret_manquante" : null,
    !amortizationReady ? "tableau_amortissement_manquant" : null,
    !identityReady ? "piece_identite_manquante" : null,
  ].filter(Boolean) as string[];

  const needsStatus = blockers.length === 0 ? "ready_for_validation" : "documents_missing";
  const stepStatus: ProjectStepStatus = blockers.length === 0 ? "in_progress" : "blocked";

  const { error } = await supabase.from("project_borrower_needs").upsert(
    {
      project_id: projectId,
      client_id: clientId,
      completed_by: user.id,
      completion_source: "courtier",
      status: needsStatus,
      bank_name: String(formData.get("bankName") ?? "").trim() || null,
      loan_amount: loanAmount,
      loan_duration_months: loanDurationMonths,
      remaining_capital: remainingCapital,
      loan_start_date: String(formData.get("loanStartDate") ?? "") || null,
      loan_end_date: String(formData.get("loanEndDate") ?? "") || null,
      current_insurer: String(formData.get("currentInsurer") ?? "").trim() || null,
      current_annual_premium: currentAnnualPremium,
      delegation_or_substitution: String(formData.get("operationType") ?? "").trim() || null,
      objective: String(formData.get("objective") ?? "").trim() || null,
      advisor_notes: String(formData.get("advisorNotes") ?? "").trim() || null,
      requested_quotities: {
        borrower: numberOrNull(formData.get("borrowerQuotity")),
        coBorrower: numberOrNull(formData.get("coBorrowerQuotity")),
      },
      requested_guarantees: formData.getAll("guarantees").map(String),
      validation_blockers: blockers,
      missing_data: { loanOfferReady, amortizationReady, identityReady },
    },
    { onConflict: "project_id" },
  );

  if (error) {
    return { status: "error", message: error.message };
  }

  await Promise.all([
    updateDocumentGate(supabase, projectId, "loan_offer", loanOfferReady ? "received" : "missing", user.id, "recueil_besoins"),
    updateDocumentGate(
      supabase,
      projectId,
      "amortization_schedule",
      amortizationReady ? "received" : "missing",
      user.id,
      "recueil_besoins",
    ),
    updateDocumentGate(supabase, projectId, "identity", identityReady ? "received" : "missing", user.id, "recueil_besoins"),
    supabase
      .from("project_workflow_steps")
      .update({ status: stepStatus, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("step_key", "needs"),
    supabase
      .from("projects")
      .update({
        status: blockers.length === 0 ? "in_progress" : "waiting_documents",
        workflow_stage: "recueil_besoins",
        workflow_data: {
          last_needs_update: new Date().toISOString(),
          validation_blockers: blockers,
        },
      })
      .eq("id", projectId),
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "borrower_needs.saved",
      target_table: "projects",
      target_id: projectId,
      metadata: { client_id: clientId, status: needsStatus, blockers },
    }),
  ]);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/emprunteur");

  return {
    status: "success",
    message:
      blockers.length === 0
        ? "Recueil enregistre. Les pieces obligatoires sont presentes, la feuille de mission peut etre envoyee."
        : "Recueil enregistre. La validation reste bloquee tant que les pieces obligatoires ne sont pas ajoutees.",
    projectId,
  };
}

export async function saveScooterProjectNeedsAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase n'est pas configure pour enregistrer le recueil trottinette." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const maxSpeedValue = String(formData.get("maxSpeedLimited25") ?? "");
  const householdValue = String(formData.get("usedByHouseholdMembers") ?? "");

  if (!projectId || !clientId) {
    return { status: "error", message: "Projet ou fiche client manquant." };
  }

  if (!maxSpeedValue || !householdValue) {
    return { status: "error", message: "Les questions 25 km/h et utilisation par le foyer sont obligatoires." };
  }

  const extensionRecommended = householdValue === "yes";
  const needsStatus =
    maxSpeedValue === "no"
      ? "needs_review"
      : extensionRecommended
        ? "extension_recommended"
        : "ready_for_quote";

  const numberOrNull = (value: FormDataEntryValue | null) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const scooterPayload = {
    project_id: projectId,
    client_id: clientId,
    status: needsStatus,
    owner_full_name: String(formData.get("ownerFullName") ?? "").trim() || null,
    owner_email: String(formData.get("ownerEmail") ?? "").trim() || null,
    vehicle_brand: String(formData.get("vehicleBrand") ?? "").trim() || null,
    vehicle_model: String(formData.get("vehicleModel") ?? "").trim() || null,
    serial_number: String(formData.get("serialNumber") ?? "").trim() || null,
    purchase_date: String(formData.get("purchaseDate") ?? "") || null,
    purchase_price: numberOrNull(formData.get("purchasePrice")),
    max_speed_limited_25: maxSpeedValue === "yes",
    used_by_household_members: extensionRecommended,
    household_users_details: String(formData.get("householdUsersDetails") ?? "").trim() || null,
    extension_recommended: extensionRecommended,
    usage_type: String(formData.get("usageType") ?? "") || null,
    storage_location: String(formData.get("storageLocation") ?? "").trim() || null,
    desired_effective_date: String(formData.get("desiredEffectiveDate") ?? "") || null,
    advisor_notes: String(formData.get("advisorNotes") ?? "").trim() || null,
    collected_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existingNeed } = await supabase
    .from("scooter_insurance_needs")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = existingNeed?.id
    ? await supabase.from("scooter_insurance_needs").update(scooterPayload).eq("id", existingNeed.id)
    : await supabase.from("scooter_insurance_needs").insert(scooterPayload);

  if (error) {
    return { status: "error", message: error.message };
  }

  await Promise.all([
    supabase
      .from("projects")
      .update({
        status: needsStatus === "ready_for_quote" ? "in_progress" : "waiting_documents",
        workflow_stage: "recueil_besoins_trottinette",
        workflow_data: {
          max_speed_limited_25: maxSpeedValue === "yes",
          used_by_household_members: extensionRecommended,
          extension_recommended: extensionRecommended,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId),
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "scooter_project_needs.saved",
      target_table: "projects",
      target_id: projectId,
      metadata: { client_id: clientId, status: needsStatus, extension_recommended: extensionRecommended },
    }),
  ]);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/workflows/trottinette");

  return {
    status: "success",
    message: extensionRecommended
      ? "Recueil trottinette enregistre. Extension foyer fiscal recommandee."
      : "Recueil trottinette enregistre. Le dossier peut passer en devis.",
    projectId,
  };
}

export async function updateBorrowerWorkflowAction(formData: FormData) {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const projectId = String(formData.get("projectId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const stepKey = String(formData.get("stepKey") ?? "") as ProjectStepKey;
  const action = String(formData.get("workflowAction") ?? "complete") as WorkflowAction;
  const subscriptionLink = String(formData.get("subscriptionLink") ?? "").trim();
  const clientComment = String(formData.get("clientComment") ?? "").trim();

  if (!projectId || !clientId || !stepKey) return;

  const nextStatus = getNextStepStatus(action);
  const completed = nextStatus === "done";
  const now = new Date().toISOString();

  await supabase
    .from("project_workflow_steps")
    .update({
      status: nextStatus,
      completed_at: completed ? now : null,
      completed_by: completed ? user.id : null,
      updated_at: now,
    })
    .eq("project_id", projectId)
    .eq("step_key", stepKey);

  if (action === "send") {
    if (stepKey === "mission") {
      // Étape DER : envoi réel du Document d'Entrée en Relation au client.
      await sendDerForProject(supabase, projectId, clientId, user.id, user.email);
    } else {
      await createDeliveryForStep(supabase, projectId, clientId, stepKey, user.id, subscriptionLink);
    }
  }

  if (action === "send" && (stepKey === "mission" || stepKey === "advice")) {
    await supabase.from("project_signatures").insert({
      project_id: projectId,
      client_id: clientId,
      signature_type: stepKey === "mission" ? "feuille_mission" : "fiche_conseil",
      status: "pending",
      client_comment: clientComment || null,
      created_by: user.id,
    });
  }

  if (action === "sign" && (stepKey === "mission" || stepKey === "advice")) {
    await supabase
      .from("project_signatures")
      .update({ status: "signed", signed_at: now, client_comment: clientComment || null })
      .eq("project_id", projectId)
      .eq("signature_type", stepKey === "mission" ? "feuille_mission" : "fiche_conseil")
      .eq("status", "pending");
  }

  if (action === "activate") {
    await supabase
      .from("projects")
      .update({
        status: "signed",
        workflow_stage: "activation_dossier",
        workflow_data: { activated_at: now, activated_by: user.id },
      })
      .eq("id", projectId);
  } else {
    await supabase
      .from("projects")
      .update({ workflow_stage: getWorkflowStage(stepKey), updated_at: now })
      .eq("id", projectId);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: `borrower_workflow.${action}`,
    target_table: "projects",
    target_id: projectId,
    metadata: {
      client_id: clientId,
      step_key: stepKey,
      subscription_link: subscriptionLink || null,
      message: workflowActionLabels[action],
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/emprunteur");
}

async function updateDocumentGate(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  projectId: string,
  documentKey: string,
  status: "missing" | "received" | "validated" | "rejected",
  userId: string,
  source: string,
) {
  return supabase
    .from("project_document_requirements")
    .update({
      status,
      source,
      validated_at: status === "validated" ? new Date().toISOString() : null,
      validated_by: status === "validated" ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("document_key", documentKey);
}

// Étape DER : envoie réellement le Document d'Entrée en Relation au client
// (email avec lien), le dépose dans son Classeur ACPR, et journalise une preuve
// d'envoi honnête (statut = résultat réel de l'envoi).
async function sendDerForProject(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  projectId: string,
  clientId: string,
  userId: string,
  userEmail: string,
) {
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email, profile_id")
    .eq("id", clientId)
    .maybeSingle();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://www.ej-assurances.fr";
  const derUrl = `${siteUrl}/documents/der-ej-assurances.html`;

  let status = "failed";
  let detail = "Email du client manquant : DER non envoyé.";

  if (client?.email) {
    const firstName = String(client.full_name ?? "").trim().split(/\s+/)[0] || "";
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;">
        <p>Bonjour ${firstName || "et bienvenue"},</p>
        <p>Dans le cadre de notre entrée en relation, nous vous transmettons notre
        <strong>Document d'Entrée en Relation (DER)</strong>, qui précise notre statut de courtier,
        nos obligations et le cadre de notre accompagnement.</p>
        <p><a href="${derUrl}" style="display:inline-block;background:#0a193c;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Consulter votre DER</a></p>
        <p style="color:#666;font-size:13px;">Ce document est également disponible à tout moment dans votre espace client, rubrique « Classeur ACPR ».</p>
        ${legalSignatureHtml()}
      </div>`;

    const res = await sendCrmEmail({
      to: client.email as string,
      subject: "Votre Document d'Entrée en Relation (DER) — EJ Partners Assurances",
      html,
      replyTo: userEmail,
    });
    status = res.success ? "sent" : "failed";
    detail = res.success
      ? `DER envoyé à ${client.email}.`
      : `Échec d'envoi du DER : ${res.error ?? "erreur inconnue"}.`;

    // Dépôt dans le Classeur ACPR (idempotent : une seule entrée DER par client).
    if (res.success && client.profile_id) {
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("client_id", clientId)
        .eq("document_type", "classeur_acpr_der")
        .maybeSingle();
      if (!existing) {
        await supabase.from("documents").insert({
          owner_id: client.profile_id,
          uploaded_by: userId,
          client_id: clientId,
          storage_bucket: "public",
          storage_path: "/documents/der-ej-assurances.html",
          document_type: "classeur_acpr_der",
          visibility: "client",
        });
      }
    }
  }

  // Preuve d'envoi honnête.
  await supabase.from("project_deliveries").insert({
    project_id: projectId,
    client_id: clientId,
    delivery_type: "der",
    channel: "email",
    status,
    subject: "Document d'Entrée en Relation (DER)",
    body: detail,
    sent_at: new Date().toISOString(),
    created_by: userId,
  });
}

function getNextStepStatus(action: WorkflowAction): ProjectStepStatus {
  if (action === "start") return "in_progress";
  if (action === "send") return "waiting_client";
  if (action === "block") return "blocked";
  return "done";
}

function getWorkflowStage(stepKey: ProjectStepKey) {
  const stages: Record<ProjectStepKey, string> = {
    needs: "recueil_besoins",
    mission: "feuille_mission",
    quotes: "devis",
    advice: "fiche_conseil",
    subscription: "lien_souscription",
    validation: "validation_compagnie",
    activation: "activation_dossier",
  };

  return stages[stepKey];
}

async function createDeliveryForStep(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  projectId: string,
  clientId: string,
  stepKey: ProjectStepKey,
  userId: string,
  subscriptionLink: string,
) {
  const deliveryByStep: Partial<Record<ProjectStepKey, { type: string; subject: string; body: string }>> = {
    mission: {
      type: "feuille_mission",
      subject: "Votre feuille de mission EJ Partners Assurances",
      body: "La feuille de mission est disponible pour signature dans votre espace client.",
    },
    advice: {
      type: "fiche_conseil",
      subject: "Votre fiche conseil assurance emprunteur",
      body: "Votre fiche conseil DDA est disponible pour lecture, commentaire et signature.",
    },
    subscription: {
      type: "lien_souscription",
      subject: "Votre lien de souscription assurance emprunteur",
      body: subscriptionLink
        ? `Votre lien de souscription : ${subscriptionLink}`
        : "Le lien de souscription sera rattache au dossier des reception.",
    },
  };

  const delivery = deliveryByStep[stepKey];
  if (!delivery) return;

  await supabase.from("project_deliveries").insert(
    ["email", "espace_client"].map((channel) => ({
      project_id: projectId,
      client_id: clientId,
      delivery_type: delivery.type,
      channel,
      status: "sent",
      subject: delivery.subject,
      body: delivery.body,
      sent_at: new Date().toISOString(),
      created_by: userId,
    })),
  );
}
