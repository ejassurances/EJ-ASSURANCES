export type ProjectStepKey =
  | "needs"
  | "mission"
  | "quotes"
  | "advice"
  | "subscription"
  | "validation"
  | "activation";

export type ProjectStepStatus = "todo" | "in_progress" | "blocked" | "waiting_client" | "done";

export type BorrowerWorkflowStepRecord = {
  id: string;
  project_id: string;
  step_key: ProjectStepKey;
  label: string;
  status: ProjectStepStatus;
  position: number;
  delivery_channels: string[] | null;
  requirements: Record<string, unknown> | null;
  completed_at: string | null;
  completed_by: string | null;
};

export type BorrowerDocumentRequirementRecord = {
  id: string;
  project_id: string;
  document_key: string;
  label: string;
  required_for_validation: boolean;
  status: "missing" | "received" | "validated" | "rejected";
  position: number;
  accepted_sources: string[] | null;
  document_id: string | null;
  source: string | null;
  source_metadata: Record<string, unknown> | null;
  validated_at: string | null;
  validated_by: string | null;
};

export type BorrowerNeedsRecord = {
  id: string;
  project_id: string;
  client_id: string;
  completion_source: "client" | "courtier" | "mandataire" | "mia" | "import_gmail";
  status: "draft" | "documents_missing" | "ready_for_validation" | "validated";
  bank_name: string | null;
  loan_amount: number | null;
  loan_duration_months: number | null;
  remaining_capital: number | null;
  loan_start_date: string | null;
  loan_end_date: string | null;
  current_insurer: string | null;
  current_annual_premium: number | null;
  requested_quotities: Record<string, unknown> | null;
  requested_guarantees: string[] | null;
  delegation_or_substitution: string | null;
  objective: string | null;
  known_data: Record<string, unknown> | null;
  missing_data: Record<string, unknown> | null;
  validation_blockers: string[] | null;
  client_comment: string | null;
  advisor_notes: string | null;
};

export type BorrowerDeliveryRecord = {
  id: string;
  project_id: string;
  delivery_type: "feuille_mission" | "devis" | "fiche_conseil" | "lien_souscription" | "relance" | "autre";
  channel: "email" | "espace_client";
  status: "draft" | "sent" | "opened" | "signed" | "commented" | "failed";
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  created_at: string;
};

export type BorrowerSignatureRecord = {
  id: string;
  project_id: string;
  signature_type: "feuille_mission" | "fiche_conseil" | "autre";
  status: "pending" | "signed" | "refused" | "expired";
  client_comment: string | null;
  requested_at: string;
  signed_at: string | null;
};

export type BorrowerEmailImportRecord = {
  id: string;
  project_id: string;
  gmail_thread_id: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  ai_summary: string | null;
  attachment_count: number;
  excluded: boolean;
};

export type BorrowerProject = {
  id: string;
  client_id: string;
  title: string;
  project_type: string;
  status: string;
  google_drive_folder_id?: string | null;
  google_drive_folder_url?: string | null;
  workflow_stage?: string | null;
  workflow_data?: Record<string, unknown> | null;
  sensitive_context: string | null;
  created_at: string;
  updated_at: string;
  project_workflow_steps?: BorrowerWorkflowStepRecord[];
  project_document_requirements?: BorrowerDocumentRequirementRecord[];
  project_borrower_needs?: BorrowerNeedsRecord[];
  project_deliveries?: BorrowerDeliveryRecord[];
  project_signatures?: BorrowerSignatureRecord[];
  project_email_imports?: BorrowerEmailImportRecord[];
  scooter_insurance_needs?: Array<{
    id: string;
    project_id: string | null;
    client_id: string | null;
    status: string;
    owner_full_name: string | null;
    owner_email: string | null;
    vehicle_brand: string | null;
    vehicle_model: string | null;
    serial_number: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    max_speed_limited_25: boolean | null;
    used_by_household_members: boolean | null;
    household_users_details: string | null;
    extension_recommended: boolean;
    usage_type: string | null;
    storage_location: string | null;
    desired_effective_date: string | null;
    advisor_notes: string | null;
  }>;
};

export type WorkflowStep = {
  key: ProjectStepKey;
  title: string;
  status: ProjectStepStatus;
  description: string;
  deliverables: string[];
  channels: string[];
};

export const borrowerRequiredDocuments = [
  {
    key: "loan_offer",
    label: "Offre de pret",
    requiredForValidation: true,
    acceptedSources: ["Espace client", "Courtier", "Mandataire", "Import Gmail"],
  },
  {
    key: "amortization_schedule",
    label: "Tableau d'amortissement",
    requiredForValidation: true,
    acceptedSources: ["Espace client", "Courtier", "Mandataire", "Import Gmail"],
  },
  {
    key: "current_insurance_certificate",
    label: "Contrat ou notice assurance actuelle",
    requiredForValidation: false,
    acceptedSources: ["Espace client", "Courtier", "Mandataire", "Import Gmail"],
  },
  {
    key: "identity",
    label: "Piece d'identite",
    requiredForValidation: true,
    acceptedSources: ["Espace client", "Courtier", "Mandataire"],
  },
  {
    key: "bank_equivalence_requirements",
    label: "Exigences equivalence garanties banque",
    requiredForValidation: false,
    acceptedSources: ["Courtier", "Mandataire", "Import Gmail"],
  },
  {
    key: "subscription_confirmation",
    label: "Validation compagnie / certificat adhesion",
    requiredForValidation: false,
    acceptedSources: ["Compagnie", "Import Gmail", "Courtier"],
  },
];

export const borrowerWorkflowSteps: WorkflowStep[] = [
  {
    key: "needs",
    title: "Recueil des besoins",
    status: "in_progress",
    description:
      "Collecter les informations credit, emprunteurs, garanties, quotites, objectif de delegation ou substitution.",
    deliverables: ["Recueil pre-rempli", "Offre de pret", "Tableau d'amortissement"],
    channels: ["Espace client", "Saisie courtier", "Saisie MIA", "Import Gmail"],
  },
  {
    key: "mission",
    title: "Entrée en relation (DER)",
    status: "todo",
    description:
      "Générer le DER (Document d'Entrée en Relation) et la fiche d'information, puis l'envoyer au client. L'ACPR vérifie l'envoi du DER — la signature n'est pas obligatoire.",
    deliverables: ["DER", "Fiche d'information", "Preuve d'envoi", "Archivage dossier projet"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "quotes",
    title: "Cotation IA",
    status: "todo",
    description: "Analyser le recueil, interroger le catalogue partenaires et générer le tableau comparatif (devis).",
    deliverables: ["Comparatif devis", "Hypotheses de garanties", "Economies estimees"],
    channels: ["Courtier", "MIA"],
  },
  {
    key: "advice",
    title: "Devoir de conseil",
    status: "todo",
    description:
      "Rédiger la note de synthèse (devoir de conseil DDA) justifiant la recommandation, l'envoyer au client et recueillir sa signature.",
    deliverables: ["Devoir de conseil", "Signature client", "Commentaire client"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "subscription",
    title: "Lien de souscription",
    status: "todo",
    description: "Envoyer le lien de souscription apres validation du conseil et des documents.",
    deliverables: ["Lien de souscription", "Suivi compagnie", "Accuse client"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "validation",
    title: "Validation compagnie",
    status: "todo",
    description: "Attendre la validation, rattacher les documents recus et transformer en contrat si accepte.",
    deliverables: ["Decision compagnie", "Conditions particulieres", "Contrat"],
    channels: ["Compagnie", "Gmail", "Espace client"],
  },
  {
    key: "activation",
    title: "Activation du dossier",
    status: "todo",
    description:
      "Activer le dossier apres validation compagnie, archiver les preuves et preparer la mise en vigueur du contrat.",
    deliverables: ["Contrat actif", "Archivage ACPR", "Notification client", "Suivi banque"],
    channels: ["CRM", "Espace client", "Email"],
  },
];

export function getBorrowerWorkflow(project?: BorrowerProject | null) {
  if (!project) {
    return borrowerWorkflowSteps;
  }

  const storedSteps = project.project_workflow_steps ?? [];

  return borrowerWorkflowSteps.map((step) => {
    const stored = storedSteps.find((item) => item.step_key === step.key);

    if (stored) {
      return {
        ...step,
        title: stored.label || step.title,
        status: stored.status,
        deliverables: Array.isArray(stored.requirements?.deliverables)
          ? (stored.requirements?.deliverables as string[])
          : step.deliverables,
        channels: stored.delivery_channels?.length ? stored.delivery_channels : step.channels,
      };
    }

    if (project.status === "waiting_documents" && step.key === "needs") {
      return { ...step, status: "blocked" as const };
    }

    if (project.status === "signed" || project.status === "closed") {
      return { ...step, status: "done" as const };
    }

    return step;
  });
}

export function getBorrowerDocumentRequirements(project?: BorrowerProject | null) {
  const storedDocuments = project?.project_document_requirements ?? [];

  return borrowerRequiredDocuments.map((document, index) => {
    const stored = storedDocuments.find((item) => item.document_key === document.key);

    return {
      ...document,
      id: stored?.id,
      status: stored?.status ?? "missing",
      position: stored?.position ?? index + 1,
      source: stored?.source ?? null,
      acceptedSources: stored?.accepted_sources?.length ? stored.accepted_sources : document.acceptedSources,
    };
  });
}

export function getBorrowerProjectProgress(project?: BorrowerProject | null) {
  const workflow = getBorrowerWorkflow(project);
  const done = workflow.filter((step) => step.status === "done").length;

  return {
    done,
    total: workflow.length,
    percent: Math.round((done / workflow.length) * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Moteur d'étapes GÉNÉRIQUE — prêt pour tous les types de projet.
// Le workflow emprunteur ci-dessus reste la référence ; tout autre type est
// mappé sur une séquence générique par défaut (à affiner par type ultérieurement,
// sans réécrire le moteur). Additif : n'altère pas les fonctions existantes.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectWorkflowDef = {
  steps: WorkflowStep[];
  requiredDocuments: typeof borrowerRequiredDocuments;
};

// Séquence générique applicable à tout projet d'assurance (santé, prévoyance,
// pro, trottinette…) : recueil → DER → devis → conseil → souscription → contrat.
export const defaultWorkflowSteps: WorkflowStep[] = [
  {
    key: "needs",
    title: "Recueil des besoins",
    status: "in_progress",
    description: "Collecter les informations nécessaires au conseil et à la cotation.",
    deliverables: ["Recueil pré-rempli"],
    channels: ["Espace client", "Saisie courtier"],
  },
  {
    key: "mission",
    title: "Entrée en relation (DER)",
    status: "todo",
    description: "Générer et envoyer le DER au client (l'ACPR vérifie l'envoi ; signature non obligatoire).",
    deliverables: ["DER", "Preuve d'envoi"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "quotes",
    title: "Devis",
    status: "todo",
    description: "Établir le comparatif / devis à partir du recueil.",
    deliverables: ["Comparatif devis"],
    channels: ["Courtier"],
  },
  {
    key: "advice",
    title: "Devoir de conseil",
    status: "todo",
    description: "Rédiger la note de synthèse (DDA), l'envoyer au client et recueillir sa signature.",
    deliverables: ["Devoir de conseil", "Signature client"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "subscription",
    title: "Souscription",
    status: "todo",
    description: "Envoyer le lien / dossier de souscription après validation du conseil.",
    deliverables: ["Lien de souscription"],
    channels: ["Email", "Espace client"],
  },
  {
    key: "activation",
    title: "Contrat actif",
    status: "todo",
    description: "Transformer en contrat, archiver les preuves et activer le dossier.",
    deliverables: ["Contrat actif", "Archivage"],
    channels: ["CRM", "Espace client"],
  },
];

export const defaultRequiredDocuments = [
  {
    key: "identity",
    label: "Pièce d'identité",
    requiredForValidation: true,
    acceptedSources: ["Espace client", "Courtier", "Mandataire"],
  },
];

// Registre type de projet -> définition de workflow. Emprunteur = spécialisé ;
// les autres types héritent du défaut générique tant qu'ils ne sont pas précisés.
export const PROJECT_WORKFLOWS: Record<string, ProjectWorkflowDef> = {
  assurance_emprunteur: { steps: borrowerWorkflowSteps, requiredDocuments: borrowerRequiredDocuments },
};

export function getWorkflowDef(projectType?: string | null): ProjectWorkflowDef {
  return (projectType && PROJECT_WORKFLOWS[projectType])
    || { steps: defaultWorkflowSteps, requiredDocuments: defaultRequiredDocuments };
}

// Applique les statuts stockés (project_workflow_steps) sur une liste d'étapes.
function mergeStepStatuses(steps: WorkflowStep[], project?: BorrowerProject | null): WorkflowStep[] {
  if (!project) return steps;
  const stored = project.project_workflow_steps ?? [];
  return steps.map((step) => {
    const rec = stored.find((item) => item.step_key === step.key);
    if (rec) {
      return {
        ...step,
        title: rec.label || step.title,
        status: rec.status,
        deliverables: Array.isArray(rec.requirements?.deliverables)
          ? (rec.requirements?.deliverables as string[])
          : step.deliverables,
        channels: rec.delivery_channels?.length ? rec.delivery_channels : step.channels,
      };
    }
    if (project.status === "waiting_documents" && step.key === "needs") {
      return { ...step, status: "blocked" as const };
    }
    if (project.status === "signed" || project.status === "closed") {
      return { ...step, status: "done" as const };
    }
    return step;
  });
}

/** Workflow d'un projet, quel que soit son type (dispatch via le registre). */
export function getProjectWorkflow(project?: BorrowerProject | null): WorkflowStep[] {
  const def = getWorkflowDef(project?.project_type);
  return mergeStepStatuses(def.steps, project);
}

/** Documents requis d'un projet, quel que soit son type. */
export function getProjectDocumentRequirements(project?: BorrowerProject | null) {
  const def = getWorkflowDef(project?.project_type);
  const storedDocuments = project?.project_document_requirements ?? [];
  return def.requiredDocuments.map((document, index) => {
    const stored = storedDocuments.find((item) => item.document_key === document.key);
    return {
      ...document,
      id: stored?.id,
      status: stored?.status ?? "missing",
      position: stored?.position ?? index + 1,
      source: stored?.source ?? null,
      acceptedSources: stored?.accepted_sources?.length ? stored.accepted_sources : document.acceptedSources,
    };
  });
}

/** Progression (done/total/percent) d'un projet, quel que soit son type. */
export function getProjectProgress(project?: BorrowerProject | null) {
  const workflow = getProjectWorkflow(project);
  const done = workflow.filter((step) => step.status === "done").length;
  return { done, total: workflow.length, percent: workflow.length ? Math.round((done / workflow.length) * 100) : 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline CRM : les 5 statuts client (vue simplifiée du workflow interne).
// Mappe le workflow_stage / les étapes internes sur 5 statuts lisibles, utilisés
// pour l'affichage d'un « Statut » unique côté fiche projet / Master Sheet.
// ─────────────────────────────────────────────────────────────────────────────

export type ClientStatusKey =
  | "recueil_besoins"
  | "der"
  | "cotation_ia"
  | "devoir_conseil"
  | "cloture";

export type ClientStatusDef = {
  key: ClientStatusKey;
  position: number;
  label: string;
  description: string;
};

export const CLIENT_STATUSES: ClientStatusDef[] = [
  { key: "recueil_besoins", position: 1, label: "Recueil des besoins", description: "Data capture — recueil rempli, dossier Drive créé." },
  { key: "der", position: 2, label: "Entrée en relation (DER)", description: "DER envoyé au client — l'ACPR vérifie l'envoi (preuve conservée) ; la signature n'est pas obligatoire." },
  { key: "cotation_ia", position: 3, label: "Cotation IA", description: "Analyse IA du besoin et tableau comparatif généré." },
  { key: "devoir_conseil", position: 4, label: "Devoir de conseil", description: "Note de synthèse DDA envoyée pour signature." },
  { key: "cloture", position: 5, label: "Clôturé / Souscrit", description: "Contrat signé, dossier archivé, commission mise à jour." },
];

// Correspondance workflow_stage interne (ou step_key) -> statut client.
const STAGE_TO_CLIENT_STATUS: Record<string, ClientStatusKey> = {
  recueil_besoins: "recueil_besoins",
  recueil_besoins_trottinette: "recueil_besoins",
  needs: "recueil_besoins",
  mission: "der",
  entree_relation: "der",
  der: "der",
  quotes: "cotation_ia",
  cotation: "cotation_ia",
  advice: "devoir_conseil",
  devoir_conseil: "devoir_conseil",
  subscription: "cloture",
  validation: "cloture",
  activation: "cloture",
  activation_dossier: "cloture",
  cloture: "cloture",
};

/** Retourne le statut client (parmi les 5) à partir du workflow_stage / step_key. */
export function resolveClientStatus(stage?: string | null): ClientStatusDef {
  const key = (stage && STAGE_TO_CLIENT_STATUS[stage]) || "recueil_besoins";
  return CLIENT_STATUSES.find((s) => s.key === key) ?? CLIENT_STATUSES[0];
}
