"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2, CheckCircle2, Loader2, X } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

type CreditForm = {
  type_bien: string;
  adresse_bien: string;
  banque: string;
  montant_emprunte: string;
  duree_mois: string;
  taux_actuel: string;
  mensualite_actuelle: string;
  date_debut_pret: string;
  assureur_actuel: string;
  prime_actuelle_mensuelle: string;
  tableau_amortissement_file: File | null;
  offre_pret_file: File | null;
};

const emptyCredit = (): CreditForm => ({
  type_bien: "",
  adresse_bien: "",
  banque: "",
  montant_emprunte: "",
  duree_mois: "",
  taux_actuel: "",
  mensualite_actuelle: "",
  date_debut_pret: "",
  assureur_actuel: "",
  prime_actuelle_mensuelle: "",
  tableau_amortissement_file: null,
  offre_pret_file: null,
});

const TYPES_BIEN = [
  "Résidence principale",
  "Résidence secondaire",
  "Investissement locatif",
];

type FileInputProps = {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
  required?: boolean;
};

function FileInput({
  label,
  file,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png",
  required,
}: FileInputProps) {
  return (
    <div className="form-field">
      <label>
        {label} {required && <span className="required">*</span>}
      </label>
      <div className={`file-drop ${file ? "file-drop--filled" : ""}`}>
        {file ? (
          <div className="file-drop__info">
            <span className="file-drop__name">{file.name}</span>
            <button
              type="button"
              className="file-drop__remove"
              onClick={() => onChange(null)}
              aria-label="Supprimer"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="file-drop__label">
            <Upload size={18} aria-hidden />
            <span>Cliquer pour choisir un fichier</span>
            <span className="file-drop__hint">PDF, JPG ou PNG</span>
            <input
              type="file"
              accept={accept}
              style={{ display: "none" }}
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function EmprunteurTunnel() {
  const [step, setStep] = useState<Step>(1);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anti-bot : honeypot + délai minimal de remplissage.
  const honeypotRef = useRef<HTMLInputElement>(null);
  const renderedAtRef = useRef(0);
  useEffect(() => { renderedAtRef.current = Date.now(); }, []);

  // Step 1: Identity
  const [identity, setIdentity] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_naissance: "",
    adresse: "",
    code_postal: "",
    ville: "",
  });

  // Step 2: Personal documents
  const [cniRecto, setCniRecto] = useState<File | null>(null);
  const [cniVerso, setCniVerso] = useState<File | null>(null);
  const [justifDomicile, setJustifDomicile] = useState<File | null>(null);

  // Step 3: Credits
  const [credits, setCredits] = useState<CreditForm[]>([emptyCredit()]);

  const supabaseClient = createSupabaseBrowserClient();

  if (!supabaseClient) {
    return <div className="tunnel-wrapper"><p>Service temporairement indisponible.</p></div>;
  }

  const supabase = supabaseClient;

  const setId =<K extends keyof typeof identity>(k: K, v: string) =>
    setIdentity((prev: typeof identity) => ({ ...prev, [k]: v }));

  const setCredit = (i: number, k: keyof CreditForm, v: string | File | null) =>
    setCredits((prev: CreditForm[]) => prev.map((c: CreditForm, idx: number) => idx === i ? { ...c, [k]: v } : c));

  // ── Step 1 → create dossier ──
  const submitStep1 = async () => {
    setError(null);
    // Anti-bot : honeypot rempli ou soumission trop rapide (< 3 s) → on bloque.
    if (honeypotRef.current?.value || Date.now() - renderedAtRef.current < 3000) {
      return;
    }
    if (!identity.full_name.trim() || !identity.email.trim()) {
      setError("Nom complet et email sont obligatoires.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("emprunteur_dossiers")
        .insert({
          full_name: identity.full_name.trim(),
          email: identity.email.trim().toLowerCase(),
          phone: identity.phone || null,
          date_naissance: identity.date_naissance || null,
          adresse: identity.adresse || null,
          code_postal: identity.code_postal || null,
          ville: identity.ville || null,
        })
        .select("id")
        .single();

      if (err) throw err;
      setDossierId(data.id);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Upload helper ──
  // Bucket privé : on NE génère jamais d'URL publique. On stocke uniquement le
  // chemin de stockage ; l'URL signée est produite à la demande côté serveur
  // (Server Action getEmprunteurDocumentUrl) au moment de l'affichage.
  const uploadFile = async (file: File, path: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage
      .from("prospect-documents")
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    return path;
  };

  // ── Step 2 → upload personal docs ──
  const submitStep2 = async () => {
    setError(null);
    if (!dossierId) return;

    const toUpload: { file: File; type: string }[] = [];
    if (cniRecto) toUpload.push({ file: cniRecto, type: "cni_recto" });
    if (cniVerso) toUpload.push({ file: cniVerso, type: "cni_verso" });
    if (justifDomicile) toUpload.push({ file: justifDomicile, type: "justif_domicile" });

    if (toUpload.length === 0) {
      setError("Veuillez déposer au moins un document.");
      return;
    }

    setIsLoading(true);
    try {
      for (const { file, type } of toUpload) {
        const ext = file.name.split(".").pop();
        const path = `${dossierId}/${type}.${ext}`;
        const storagePath = await uploadFile(file, path);

        const { error: docErr } = await supabase.from("emprunteur_documents").insert({
          dossier_id: dossierId,
          type_document: type,
          file_name: file.name,
          // Chemin de stockage (bucket privé), pas une URL publique.
          file_url: storagePath,
        });
        if (docErr) throw docErr;
      }
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors du dépôt des documents.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3 → save credits ──
  const submitStep3 = async () => {
    setError(null);
    if (!dossierId) return;
    setIsLoading(true);
    try {
      for (let i = 0; i < credits.length; i++) {
        const c = credits[i];
        // Chemins de stockage (bucket privé), signés à la demande côté serveur.
        let tableauPath: string | null = null;
        let offrePath: string | null = null;

        if (c.tableau_amortissement_file) {
          const ext = c.tableau_amortissement_file.name.split(".").pop();
          tableauPath = await uploadFile(c.tableau_amortissement_file, `${dossierId}/credit-${i}-tableau.${ext}`);
        }
        if (c.offre_pret_file) {
          const ext = c.offre_pret_file.name.split(".").pop();
          offrePath = await uploadFile(c.offre_pret_file, `${dossierId}/credit-${i}-offre.${ext}`);
        }

        const { error: creditErr } = await supabase.from("emprunteur_credits").insert({
          dossier_id: dossierId,
          type_bien: c.type_bien || null,
          adresse_bien: c.adresse_bien || null,
          banque: c.banque || null,
          montant_emprunte: c.montant_emprunte ? parseFloat(c.montant_emprunte) : null,
          duree_mois: c.duree_mois ? parseInt(c.duree_mois) : null,
          taux_actuel: c.taux_actuel ? parseFloat(c.taux_actuel) : null,
          mensualite_actuelle: c.mensualite_actuelle ? parseFloat(c.mensualite_actuelle) : null,
          date_debut_pret: c.date_debut_pret || null,
          assureur_actuel: c.assureur_actuel || null,
          prime_actuelle_mensuelle: c.prime_actuelle_mensuelle ? parseFloat(c.prime_actuelle_mensuelle) : null,
          tableau_amortissement_url: tableauPath,
          offre_pret_url: offrePath,
          sort_order: i,
        });
        if (creditErr) throw creditErr;
      }

      // Mark dossier as documents_uploaded
      await supabase
        .from("emprunteur_dossiers")
        .update({ status: "documents_uploaded", updated_at: new Date().toISOString() })
        .eq("id", dossierId);

      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement des crédits.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── File input component ──
  return (
    <div className="tunnel-wrapper">
      {/* Progress bar */}
      <div className="tunnel-progress" aria-hidden>
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`tunnel-progress__step ${step >= s ? "tunnel-progress__step--active" : ""} ${step > s ? "tunnel-progress__step--done" : ""}`}
          >
            <div className="tunnel-progress__dot">{step > s ? <CheckCircle2 size={14} /> : s}</div>
            <span className="tunnel-progress__label">
              {s === 1 ? "Identité" : s === 2 ? "Documents" : s === 3 ? "Crédit(s)" : "Confirmation"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="form-error-banner">
          <X size={16} aria-hidden /> {error}
        </div>
      )}

      {/* ── STEP 1 : Identity ── */}
      {step === 1 && (
        <section className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">Étape 1 / 3</p>
            <h2>Vos informations personnelles</h2>
            <p className="tunnel-section__desc">Ces informations nous permettent de préparer votre dossier d'assurance emprunteur.</p>
          </div>

          <div className="client-form">
            {/* Anti-bot : honeypot invisible. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
              <input ref={honeypotRef} type="text" name="company_url" tabIndex={-1} autoComplete="off" />
            </div>
            <fieldset className="form-section">
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="full_name">Nom complet <span className="required">*</span></label>
                  <input
                    id="full_name"
                    type="text"
                    placeholder="Prénom Nom"
                    value={identity.full_name}
                    onChange={(e) => setId("full_name", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="email">Adresse email <span className="required">*</span></label>
                  <input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={identity.email}
                    onChange={(e) => setId("email", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="phone">Téléphone</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="06 00 00 00 00"
                    value={identity.phone}
                    onChange={(e) => setId("phone", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="date_naissance">Date de naissance</label>
                  <input
                    id="date_naissance"
                    type="date"
                    value={identity.date_naissance}
                    onChange={(e) => setId("date_naissance", e.target.value)}
                  />
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="adresse">Adresse</label>
                  <input
                    id="adresse"
                    type="text"
                    placeholder="12 rue des Fleurs"
                    value={identity.adresse}
                    onChange={(e) => setId("adresse", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="code_postal">Code postal</label>
                  <input
                    id="code_postal"
                    type="text"
                    placeholder="75001"
                    value={identity.code_postal}
                    onChange={(e) => setId("code_postal", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ville">Ville</label>
                  <input
                    id="ville"
                    type="text"
                    placeholder="Paris"
                    value={identity.ville}
                    onChange={(e) => setId("ville", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <div className="form-actions">
              <button
                type="button"
                className="primary-action"
                onClick={submitStep1}
                disabled={isLoading}
              >
                {isLoading ? <><Loader2 size={18} className="spin" /> Enregistrement…</> : <>Continuer <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 2 : Documents ── */}
      {step === 2 && (
        <section className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">Étape 2 / 3</p>
            <h2>Vos documents personnels</h2>
            <p className="tunnel-section__desc">Déposez votre pièce d'identité et un justificatif de domicile récent (moins de 3 mois).</p>
          </div>

          <div className="client-form">
            <fieldset className="form-section">
              <legend>Pièce d'identité</legend>
              <div className="form-grid-2">
                <FileInput label="CNI — Recto" file={cniRecto} onChange={setCniRecto} required />
                <FileInput label="CNI — Verso" file={cniVerso} onChange={setCniVerso} />
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Justificatif de domicile</legend>
              <FileInput
                label="Justificatif de domicile (facture EDF, quittance loyer…)"
                file={justifDomicile}
                onChange={setJustifDomicile}
                required
              />
            </fieldset>

            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={() => setStep(1)} disabled={isLoading}>
                <ChevronLeft size={18} /> Retour
              </button>
              <button type="button" className="primary-action" onClick={submitStep2} disabled={isLoading}>
                {isLoading ? <><Loader2 size={18} className="spin" /> Upload…</> : <>Continuer <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 3 : Credits ── */}
      {step === 3 && (
        <section className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">Étape 3 / 3</p>
            <h2>Votre ou vos crédits immobiliers</h2>
            <p className="tunnel-section__desc">Renseignez chaque bien à assurer. Vous pouvez en ajouter plusieurs.</p>
          </div>

          <div className="client-form">
            {credits.map((credit, i) => (
              <fieldset key={i} className="form-section credit-block">
                <legend>
                  Bien {i + 1}
                  {credits.length > 1 && (
                    <button
                      type="button"
                      className="credit-block__remove"
                      onClick={() => setCredits((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  )}
                </legend>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Type de bien</label>
                    <select value={credit.type_bien} onChange={(e) => setCredit(i, "type_bien", e.target.value)}>
                      <option value="">Sélectionner…</option>
                      {TYPES_BIEN.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Adresse du bien</label>
                    <input
                      type="text"
                      placeholder="12 rue des Oliviers, 75001 Paris"
                      value={credit.adresse_bien}
                      onChange={(e) => setCredit(i, "adresse_bien", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Banque prêteuse</label>
                    <input
                      type="text"
                      placeholder="Crédit Agricole, BNP…"
                      value={credit.banque}
                      onChange={(e) => setCredit(i, "banque", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Montant emprunté (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="250 000"
                      value={credit.montant_emprunte}
                      onChange={(e) => setCredit(i, "montant_emprunte", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Durée du prêt (mois)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="240"
                      value={credit.duree_mois}
                      onChange={(e) => setCredit(i, "duree_mois", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Taux du prêt (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="3.50"
                      value={credit.taux_actuel}
                      onChange={(e) => setCredit(i, "taux_actuel", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Mensualité actuelle (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1 200"
                      value={credit.mensualite_actuelle}
                      onChange={(e) => setCredit(i, "mensualite_actuelle", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Date de début du prêt</label>
                    <input
                      type="date"
                      value={credit.date_debut_pret}
                      onChange={(e) => setCredit(i, "date_debut_pret", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Assureur actuel (si remplacement)</label>
                    <input
                      type="text"
                      placeholder="CNP, Cardif…"
                      value={credit.assureur_actuel}
                      onChange={(e) => setCredit(i, "assureur_actuel", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Prime assurance actuelle / mois (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="45"
                      value={credit.prime_actuelle_mensuelle}
                      onChange={(e) => setCredit(i, "prime_actuelle_mensuelle", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2" style={{ marginTop: "16px" }}>
                  <FileInput
                    label="Tableau d'amortissement"
                    file={credit.tableau_amortissement_file}
                    onChange={(f) => setCredit(i, "tableau_amortissement_file", f)}
                  />
                  <FileInput
                    label="Offre de prêt"
                    file={credit.offre_pret_file}
                    onChange={(f) => setCredit(i, "offre_pret_file", f)}
                  />
                </div>
              </fieldset>
            ))}

            <button
              type="button"
              className="add-credit-btn"
              onClick={() => setCredits((prev) => [...prev, emptyCredit()])}
            >
              <Plus size={16} /> Ajouter un bien
            </button>

            <div className="form-actions">
              <button type="button" className="secondary-action" onClick={() => setStep(2)} disabled={isLoading}>
                <ChevronLeft size={18} /> Retour
              </button>
              <button type="button" className="primary-action" onClick={submitStep3} disabled={isLoading}>
                {isLoading ? <><Loader2 size={18} className="spin" /> Envoi…</> : <>Envoyer mon dossier <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 4 : Confirmation ── */}
      {step === 4 && (
        <section className="tunnel-section tunnel-section--confirmation">
          <div className="tunnel-confirmation">
            <CheckCircle2 size={64} className="tunnel-confirmation__icon" />
            <h2>Dossier reçu !</h2>
            <p>
              Merci {identity.full_name.split(" ")[0]}, votre dossier a bien été transmis à EJ Partners Assurances.
              Nous allons l'étudier et vous recontacterons dans les plus brefs délais à l'adresse{" "}
              <strong>{identity.email}</strong>.
            </p>
            <p className="tunnel-confirmation__sub">
              Vous pouvez fermer cette page.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
