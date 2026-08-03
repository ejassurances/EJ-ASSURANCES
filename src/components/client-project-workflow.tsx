"use client";

import { useState, useActionState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSignature,
  PlayCircle,
  Send,
} from "lucide-react";
import {
  createBorrowerProjectAction,
  createScooterProjectAction,
  saveBorrowerNeedsAction,
  saveScooterProjectNeedsAction,
  updateBorrowerWorkflowAction,
  type ProjectActionState,
} from "@/lib/actions/projects";
import {
  getProjectDocumentRequirements,
  getProjectProgress,
  getProjectWorkflow,
  type BorrowerProject,
  type ProjectStepStatus,
} from "@/lib/project-workflow";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

type ClientProjectWorkflowProps = {
  clientId: string;
  projects: BorrowerProject[];
};

type AmortAIResult = {
  extracted: {
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
  projection: {
    effectiveDate: string | null;
    monthlyPayment: number | null;
    paymentsElapsed: number;
    remainingMonths: number;
    remainingCapitalAtEffective: number | null;
    insuredCapitalRemaining: number | null;
    currentInsuranceRemaining: number | null;
  } | null;
};

const euro = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const frDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const initialState: ProjectActionState = { status: "idle", message: "" };

const statusLabels: Record<ProjectStepStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  blocked: "Bloqué",
  waiting_client: "Attente client",
  done: "Terminé",
};

// Statut d'un document requis → ton/label du StatusBadge partagé.
const docTone: Record<string, { tone: StatusTone; label: string }> = {
  missing: { tone: "danger", label: "Manquant" },
  received: { tone: "info", label: "Reçu" },
  validated: { tone: "success", label: "Validé" },
  rejected: { tone: "warning", label: "À revoir" },
};

export function ClientProjectWorkflow({ clientId, projects }: ClientProjectWorkflowProps) {
  const [actionState, formAction, isPending] = useActionState(createBorrowerProjectAction, initialState);
  const [scooterState, scooterFormAction, isCreatingScooter] = useActionState(createScooterProjectAction, initialState);
  const [needsState, needsFormAction, isSavingNeeds] = useActionState(saveBorrowerNeedsAction, initialState);
  const [scooterNeedsState, scooterNeedsFormAction, isSavingScooterNeeds] = useActionState(
    saveScooterProjectNeedsAction,
    initialState,
  );

  // ── Intake IA « tableau d'amortissement » (début de workflow emprunteur) ────
  const [amortAI, setAmortAI] = useState<AmortAIResult | null>(null);
  const [amortBusy, setAmortBusy] = useState(false);
  const [amortError, setAmortError] = useState<string | null>(null);
  const [bankDebitDate, setBankDebitDate] = useState("");

  async function analyzeAmortization(file: File) {
    setAmortError(null);
    setAmortBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read-failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ia/amortization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: dataUrl,
          fileName: file.name,
          mimeType: file.type,
          bankDebitDate: bankDebitDate || null,
          clientId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAmortError(json?.error ?? "Analyse impossible.");
        return;
      }
      setAmortAI(json as AmortAIResult);
    } catch {
      setAmortError("Analyse impossible. Réessayez avec un document plus net.");
    } finally {
      setAmortBusy(false);
    }
  }

  const ongoingProjects = projects.filter(
    (project) => !["closed", "signed", "archived", "terminated"].includes(project.status),
  );
  const activeProject = ongoingProjects[0] ?? null;
  const isScooter = activeProject?.project_type === "assurance_trottinette";

  const workflow = getProjectWorkflow(activeProject);
  const documentRequirements = getProjectDocumentRequirements(activeProject);
  const progress = getProjectProgress(activeProject);
  const needs = activeProject?.project_borrower_needs?.[0] ?? null;
  const scooterNeeds = activeProject?.scooter_insurance_needs?.[0] ?? null;

  // Valeurs de pré-remplissage du recueil : priorité à l'extraction IA, sinon au recueil existant.
  const ax = amortAI?.extracted;
  const proj = amortAI?.projection;
  const prefill = {
    bankName: ax?.bank_name ?? needs?.bank_name ?? "",
    loanAmount: ax?.loan_amount ?? needs?.loan_amount ?? "",
    loanDurationMonths: ax?.duration_months ?? needs?.loan_duration_months ?? "",
    remainingCapital: proj?.remainingCapitalAtEffective ?? needs?.remaining_capital ?? "",
    currentAnnualPremium: ax?.current_annual_premium ?? needs?.current_annual_premium ?? "",
    loanStartDate: ax?.first_payment_date ?? needs?.loan_start_date ?? "",
    currentInsurer: ax?.current_insurer ?? needs?.current_insurer ?? "",
    borrowerQuotity: ax?.borrower_quotity ?? Number(needs?.requested_quotities?.borrower ?? 100),
    coBorrowerQuotity: ax?.co_borrower_quotity ?? Number(needs?.requested_quotities?.coBorrower ?? 0),
  };
  const deliveries = activeProject?.project_deliveries ?? [];
  const signatures = activeProject?.project_signatures ?? [];
  const imports = activeProject?.project_email_imports?.filter((item) => !item.excluded) ?? [];
  const requiredDocumentsReady = documentRequirements
    .filter((document) => document.requiredForValidation)
    .every((document) => document.status === "received" || document.status === "validated");

  // Étape active de l'assistant (navigation client). Défaut : 1re étape non terminée.
  const firstOpen = Math.max(0, workflow.findIndex((s) => s.status !== "done"));
  const [stepIdx, setStepIdx] = useState(firstOpen);
  const idx = Math.min(stepIdx, Math.max(0, workflow.length - 1));
  const activeStep = workflow[idx];

  // ── État sans projet : création ──────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="bo-wf">
        <div className="bo-wf-head">
          <h3>Nouveau projet</h3>
          <p className="bo-wf-sub">Créez un projet pour lancer l'assistant guidé (recueil → conseil → souscription → contrat).</p>
        </div>
        <div className="bo-wf-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="bo-wf-panel">
            <div className="bo-wf-panel-h"><h4>Assurance emprunteur</h4></div>
            <form action={formAction} className="bo-wf-panel-b">
              <input type="hidden" name="clientId" value={clientId} />
              <label className="project-notes-field">Nom du projet
                <input name="projectTitle" defaultValue="Assurance emprunteur" />
              </label>
              <div className="bo-wf-actions" style={{ marginTop: 12 }}>
                <button className="bo-wf-btn bo-wf-btn--primary" type="submit" disabled={isPending}>
                  <ClipboardCheck size={14} aria-hidden /> {isPending ? "Création…" : "Créer le projet"}
                </button>
              </div>
              {actionState.message && (
                <p className={actionState.status === "success" ? "form-success" : "form-error"}>{actionState.message}</p>
              )}
            </form>
          </div>
          <div className="bo-wf-panel">
            <div className="bo-wf-panel-h"><h4>Assurance trottinette</h4></div>
            <form action={scooterFormAction} className="bo-wf-panel-b">
              <input type="hidden" name="clientId" value={clientId} />
              <label className="project-notes-field">Nom du projet
                <input name="projectTitle" defaultValue="Assurance trottinette" />
              </label>
              <div className="bo-wf-actions" style={{ marginTop: 12 }}>
                <button className="bo-wf-btn bo-wf-btn--primary" type="submit" disabled={isCreatingScooter}>
                  <ClipboardCheck size={14} aria-hidden /> {isCreatingScooter ? "Création…" : "Créer le projet trottinette"}
                </button>
              </div>
              {scooterState.message && (
                <p className={scooterState.status === "success" ? "form-success" : "form-error"}>{scooterState.message}</p>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant guidé ──────────────────────────────────────────────────────
  return (
    <div className="bo-wf">
      <div className="bo-wf-head" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3>{activeProject.title}</h3>
        <span className="bo-wf-chip">En cours · Étape {idx + 1}/{workflow.length}</span>
      </div>
      <p className="bo-wf-sub" style={{ marginTop: -12 }}>
        Assistant guidé — une étape à la fois, du recueil jusqu'à la souscription du contrat.
      </p>

      {/* Stepper */}
      <div className="bo-wf-stepper" role="tablist" aria-label="Étapes du projet">
        {workflow.map((step, i) => {
          const cls = step.status === "done" ? "is-done" : i === idx ? "is-active" : "";
          return (
            <button key={step.key} type="button" className={`bo-wf-st ${cls}`} onClick={() => setStepIdx(i)} role="tab" aria-selected={i === idx}>
              <span className="bo-wf-dot">{step.status === "done" ? "✓" : i + 1}</span>
              <span className="bo-wf-lab">{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="bo-wf-grid">
        {/* Panneau de l'étape active */}
        <div className="bo-wf-panel">
          <div className="bo-wf-panel-h">
            <h4>Étape {idx + 1} — {activeStep.title}</h4>
            <span className="bo-wf-stepi">Étape {idx + 1} sur {workflow.length} · {statusLabels[activeStep.status]}</span>
          </div>

          <div className="bo-wf-panel-b">
            <p>{activeStep.description}</p>

            {/* Recueil des besoins → formulaire (selon le type de projet) */}
            {activeStep.key === "needs" && !isScooter && (
              <>
                <div className="bo-wf-hint">✨ Les données connues sont pré-remplies depuis la fiche client. Vous ne complétez que ce qui manque.</div>

                {/* Intake IA : tableau d'amortissement → extraction + calcul CRD à la date d'effet */}
                <div className="amort-ai">
                  <div className="amort-ai-head">
                    <b>Analyse IA du tableau d'amortissement</b>
                    <span>Importez le tableau (PDF ou image) : l'IA pré-remplit le recueil et calcule le capital restant dû à la date d'effet.</span>
                  </div>
                  <div className="amort-ai-controls">
                    <label>Date de prélèvement prévue par la banque
                      <input
                        type="date"
                        value={bankDebitDate}
                        onChange={(event) => setBankDebitDate(event.target.value)}
                      />
                    </label>
                    <label>Tableau d'amortissement
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        disabled={amortBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void analyzeAmortization(file);
                        }}
                      />
                    </label>
                  </div>
                  {amortBusy && <p className="amort-ai-status">Analyse en cours…</p>}
                  {amortError && <p className="form-error">{amortError}</p>}
                  {proj && (
                    <div className="amort-ai-results">
                      <div><small>Date d'effet (prélèvement + 3 mois)</small><b>{frDate(proj.effectiveDate)}</b></div>
                      <div><small>Capital restant dû à la date d'effet</small><b>{euro(proj.remainingCapitalAtEffective)}</b></div>
                      <div><small>Capital assuré restant (quotité)</small><b>{euro(proj.insuredCapitalRemaining)}</b></div>
                      <div><small>Primes restantes chez l'assureur actuel</small><b>{euro(proj.currentInsuranceRemaining)}</b></div>
                      <div><small>Mensualité (hors assurance)</small><b>{euro(proj.monthlyPayment)}</b></div>
                      <div><small>Échéances restantes</small><b>{proj.remainingMonths} mois</b></div>
                    </div>
                  )}
                  {ax?.notes && <p className="amort-ai-note">Note IA : {ax.notes}</p>}
                  {amortAI && (
                    <p className="form-success">Recueil pré-rempli ci-dessous — vérifiez puis enregistrez.</p>
                  )}
                </div>

                <form key={amortAI ? "needs-ai" : "needs-base"} action={needsFormAction} id="wf-form" className="project-needs-form">
                  <input type="hidden" name="projectId" value={activeProject.id} />
                  <input type="hidden" name="clientId" value={clientId} />
                  <div className="project-needs-grid">
                    <label>Banque<input name="bankName" defaultValue={prefill.bankName} placeholder="Banque prêteuse" /></label>
                    <label>Type d'opération
                      <select name="operationType" defaultValue={needs?.delegation_or_substitution ?? "Substitution assurance emprunteur"}>
                        <option>Delegation assurance emprunteur</option>
                        <option>Substitution assurance emprunteur</option>
                        <option>Renegociation / optimisation</option>
                      </select>
                    </label>
                    <label>Montant emprunté<input name="loanAmount" type="number" min="0" defaultValue={prefill.loanAmount} /></label>
                    <label>Durée en mois<input name="loanDurationMonths" type="number" min="0" defaultValue={prefill.loanDurationMonths} /></label>
                    <label>Capital restant dû<input name="remainingCapital" type="number" min="0" defaultValue={prefill.remainingCapital} /></label>
                    <label>Prime annuelle actuelle<input name="currentAnnualPremium" type="number" min="0" defaultValue={prefill.currentAnnualPremium} /></label>
                    <label>Date début prêt<input name="loanStartDate" type="date" defaultValue={prefill.loanStartDate} /></label>
                    <label>Date fin prêt<input name="loanEndDate" type="date" defaultValue={needs?.loan_end_date ?? ""} /></label>
                    <label>Assureur actuel<input name="currentInsurer" defaultValue={prefill.currentInsurer} placeholder="Banque, CNP, Cardif…" /></label>
                    <label>Quotité emprunteur 1<input name="borrowerQuotity" type="number" min="0" max="100" defaultValue={prefill.borrowerQuotity} /></label>
                    <label>Quotité co-emprunteur<input name="coBorrowerQuotity" type="number" min="0" max="100" defaultValue={prefill.coBorrowerQuotity} /></label>
                    <label>Objectif client<textarea name="objective" defaultValue={needs?.objective ?? ""} placeholder="Économiser, sécuriser le logement, adapter les quotités…" /></label>
                  </div>
                  <div className="project-guarantee-row">
                    {["Deces", "PTIA", "ITT", "IPT", "IPP", "Perte emploi"].map((guarantee) => (
                      <label key={guarantee} className="project-check-pill">
                        <input type="checkbox" name="guarantees" value={guarantee}
                          defaultChecked={(needs?.requested_guarantees ?? ["Deces", "PTIA", "ITT", "IPT"]).includes(guarantee)} />
                        {guarantee}
                      </label>
                    ))}
                  </div>
                  <div className="project-doc-checks">
                    <label><input type="checkbox" name="loanOfferReady" defaultChecked={documentRequirements.find((d) => d.key === "loan_offer")?.status !== "missing"} /> Offre de prêt reçue</label>
                    <label><input type="checkbox" name="amortizationReady" defaultChecked={documentRequirements.find((d) => d.key === "amortization_schedule")?.status !== "missing"} /> Tableau d'amortissement reçu</label>
                    <label><input type="checkbox" name="identityReady" defaultChecked={documentRequirements.find((d) => d.key === "identity")?.status !== "missing"} /> Pièce d'identité reçue</label>
                  </div>
                  <label className="project-notes-field">Notes conseiller / MIA<textarea name="advisorNotes" defaultValue={needs?.advisor_notes ?? ""} /></label>
                  <p className={requiredDocumentsReady ? "form-success" : "form-error"} style={{ marginTop: 10 }}>
                    {requiredDocumentsReady ? "Pièces obligatoires présentes : le recueil peut passer en validation." : "Validation bloquée : pièces obligatoires manquantes."}
                  </p>
                  {needsState.message && (
                    <p className={needsState.status === "success" ? "form-success" : "form-error"}>{needsState.message}</p>
                  )}
                </form>
              </>
            )}

            {/* Recueil trottinette */}
            {activeStep.key === "needs" && isScooter && (
              <form action={scooterNeedsFormAction} id="wf-form" className="project-needs-form">
                <input type="hidden" name="projectId" value={activeProject.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <div className="project-needs-grid">
                  <label>Nom de l'assuré<input name="ownerFullName" defaultValue={scooterNeeds?.owner_full_name ?? ""} /></label>
                  <label>Email<input name="ownerEmail" type="email" defaultValue={scooterNeeds?.owner_email ?? ""} /></label>
                  <label>Marque<input name="vehicleBrand" defaultValue={scooterNeeds?.vehicle_brand ?? ""} /></label>
                  <label>Modèle<input name="vehicleModel" defaultValue={scooterNeeds?.vehicle_model ?? ""} /></label>
                  <label>Numéro de série<input name="serialNumber" defaultValue={scooterNeeds?.serial_number ?? ""} /></label>
                  <label>Prix d'achat<input name="purchasePrice" inputMode="decimal" defaultValue={scooterNeeds?.purchase_price ?? ""} /></label>
                  <label>Date d'achat<input name="purchaseDate" type="date" defaultValue={scooterNeeds?.purchase_date ?? ""} /></label>
                  <label>Usage
                    <select name="usageType" defaultValue={scooterNeeds?.usage_type ?? ""}>
                      <option value="">À qualifier</option>
                      <option value="loisir">Loisir</option>
                      <option value="trajet_travail">Trajet domicile-travail</option>
                      <option value="mixte">Mixte</option>
                      <option value="professionnel">Professionnel</option>
                    </select>
                  </label>
                  <label>Lieu de stationnement<input name="storageLocation" defaultValue={scooterNeeds?.storage_location ?? ""} /></label>
                  <label>Date d'effet souhaitée<input name="desiredEffectiveDate" type="date" defaultValue={scooterNeeds?.desired_effective_date ?? ""} /></label>
                </div>
                <div className="project-doc-checks">
                  <label><input type="radio" name="maxSpeedLimited25" value="yes" defaultChecked={scooterNeeds?.max_speed_limited_25 === true} /> Trottinette limitée à 25 km/h</label>
                  <label><input type="radio" name="maxSpeedLimited25" value="no" defaultChecked={scooterNeeds?.max_speed_limited_25 === false} /> Vitesse à vérifier / non limitée</label>
                </div>
                <div className="project-doc-checks">
                  <label><input type="radio" name="usedByHouseholdMembers" value="yes" defaultChecked={scooterNeeds?.used_by_household_members === true} /> Utilisée par d'autres membres du foyer fiscal</label>
                  <label><input type="radio" name="usedByHouseholdMembers" value="no" defaultChecked={scooterNeeds?.used_by_household_members === false} /> Usage individuel uniquement</label>
                </div>
                <label className="project-notes-field">Détails des autres utilisateurs<textarea name="householdUsersDetails" defaultValue={scooterNeeds?.household_users_details ?? ""} /></label>
                <label className="project-notes-field">Notes conseiller<textarea name="advisorNotes" defaultValue={scooterNeeds?.advisor_notes ?? ""} /></label>
                <p className={scooterNeeds?.extension_recommended ? "form-success" : "form-note"} style={{ marginTop: 10 }}>
                  {scooterNeeds?.extension_recommended ? "Extension foyer fiscal recommandée." : "L'extension sera recommandée si la trottinette est utilisée par d'autres membres du foyer fiscal."}
                </p>
                {scooterNeedsState.message && (
                  <p className={scooterNeedsState.status === "success" ? "form-success" : "form-error"}>{scooterNeedsState.message}</p>
                )}
              </form>
            )}

            {/* Autres étapes : livrables + canaux */}
            {activeStep.key !== "needs" && (
              <div className="project-step-lists">
                <div><small>Livrables</small>{activeStep.deliverables.map((item) => <b key={item}>{item}</b>)}</div>
                <div><small>Canaux</small>{activeStep.channels.map((item) => <b key={item}>{item}</b>)}</div>
              </div>
            )}
          </div>

          {/* Navigation + actions de l'étape */}
          <div className="bo-wf-foot">
            <button type="button" className="bo-wf-btn" disabled={idx === 0} onClick={() => setStepIdx(Math.max(0, idx - 1))}>← Étape précédente</button>
            <div className="bo-wf-actions">
              {/* Sauvegarde du recueil */}
              {activeStep.key === "needs" && !isScooter && (
                <button className="bo-wf-btn" type="submit" form="wf-form" disabled={isSavingNeeds}>
                  <ClipboardCheck size={14} aria-hidden /> {isSavingNeeds ? "Enregistrement…" : "Enregistrer le recueil"}
                </button>
              )}
              {activeStep.key === "needs" && isScooter && (
                <button className="bo-wf-btn" type="submit" form="wf-form" disabled={isSavingScooterNeeds}>
                  <ClipboardCheck size={14} aria-hidden /> {isSavingScooterNeeds ? "Enregistrement…" : "Enregistrer le recueil"}
                </button>
              )}
              {/* Actions de workflow (démarrer / envoyer / signer / valider / activer) */}
              <form action={updateBorrowerWorkflowAction} className="bo-wf-actions" style={{ margin: 0 }}>
                <input type="hidden" name="projectId" value={activeProject.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="stepKey" value={activeStep.key} />
                {activeStep.key === "subscription" && <input name="subscriptionLink" placeholder="Lien de souscription compagnie" />}
                {activeStep.key === "advice" && <input name="clientComment" placeholder="Commentaire client éventuel" />}
                {activeStep.status === "todo" && (
                  <button className="bo-wf-btn" name="workflowAction" value="start" type="submit"><PlayCircle size={13} aria-hidden /> Démarrer</button>
                )}
                {(activeStep.key === "mission" || activeStep.key === "advice" || activeStep.key === "subscription") && activeStep.status !== "done" && (
                  <button className="bo-wf-btn" name="workflowAction" value="send" type="submit"><Send size={13} aria-hidden /> Envoyer</button>
                )}
                {(activeStep.key === "mission" || activeStep.key === "advice") && activeStep.status !== "done" && (
                  <button className="bo-wf-btn" name="workflowAction" value="sign" type="submit"><FileSignature size={13} aria-hidden /> Signer</button>
                )}
                {activeStep.key !== "activation" && activeStep.status !== "done" && (
                  <button className="bo-wf-btn bo-wf-btn--primary" name="workflowAction" value="complete" type="submit"><CheckCircle2 size={13} aria-hidden /> Valider l'étape</button>
                )}
                {activeStep.key === "activation" && activeStep.status !== "done" && (
                  <button className="bo-wf-btn bo-wf-btn--primary" name="workflowAction" value="activate" type="submit"><CheckCircle2 size={13} aria-hidden /> Activer le dossier</button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Rail latéral */}
        <div className="bo-wf-rail">
          <div className="bo-wf-railcard"><div className="bo-wf-panel-b">
            <p className="bo-wf-railh">Résumé du projet</p>
            <div className="bo-wf-kv"><span className="k">Titre</span><span className="v">{activeProject.title}</span></div>
            <div className="bo-wf-kv"><span className="k">Type</span><span className="v">{isScooter ? "Trottinette" : "Emprunteur"}</span></div>
            <div className="bo-wf-kv"><span className="k">Statut CRM</span><span className="v">{activeProject.status}</span></div>
            {ongoingProjects.length > 1 && <div className="bo-wf-kv"><span className="k">Projets en cours</span><span className="v">{ongoingProjects.length}</span></div>}
            <p className="bo-wf-railh" style={{ marginTop: 12 }}>Progression</p>
            <div className="bo-wf-prog"><i style={{ width: `${progress.percent}%` }} /></div>
            <div className="bo-wf-kv"><span className="k">{progress.done} étape{progress.done !== 1 ? "s" : ""} sur {progress.total}</span><span className="v">{progress.percent} %</span></div>
            {activeProject.google_drive_folder_url && (
              <p style={{ marginTop: 10 }}><a href={activeProject.google_drive_folder_url} target="_blank" rel="noreferrer" className="cf360-add-btn"><ExternalLink size={13} aria-hidden /> Dossier Drive</a></p>
            )}
          </div></div>

          {documentRequirements.length > 0 && (
            <div className="bo-wf-railcard"><div className="bo-wf-panel-b">
              <p className="bo-wf-railh">Documents requis</p>
              {documentRequirements.map((document) => {
                const cfg = docTone[document.status] ?? docTone.missing;
                return (
                  <div key={document.key} className="bo-wf-doc">
                    <span>{document.label}{document.requiredForValidation ? "" : " (compl.)"}</span>
                    <StatusBadge tone={cfg.tone} label={cfg.label} />
                  </div>
                );
              })}
            </div></div>
          )}

          <div className="bo-wf-railcard"><div className="bo-wf-panel-b bo-wf-trace">
            <p className="bo-wf-railh">Traçabilité</p>
            <p><b>Envois :</b> {deliveries.length ? deliveries.slice(0, 3).map((d) => `${d.delivery_type}/${d.status}`).join(" · ") : "aucun"}</p>
            <p><b>Signatures :</b> {signatures.length ? signatures.slice(0, 3).map((s) => `${s.signature_type}/${s.status}`).join(" · ") : "aucune"}</p>
            <p><b>Imports Gmail :</b> {imports.length ? `${imports.length} email(s) rattaché(s)` : "aucun"}</p>
          </div></div>
        </div>
      </div>
    </div>
  );
}
