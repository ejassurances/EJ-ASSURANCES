"use client";

import { useEffect, useState, useTransition } from "react";
import { addRelatedPersonAction } from "@/lib/actions/interactions";
import { listClientOptions } from "@/lib/actions/clients";
import { Users, Loader2, Plus, X, UserPlus, Link2 } from "lucide-react";

const TYPES_RELATION = [
  { value: "conjoint", label: "Conjoint(e) / Partenaire" },
  { value: "enfant", label: "Enfant" },
  { value: "parent_social", label: "Parent social" },
  { value: "co_parent", label: "Co-parent" },
  { value: "co_assure", label: "Co-assuré(e)" },
  { value: "autre", label: "Autre" },
] as const;

type ClientOption = { id: string; full_name: string | null; email: string | null };

type Props = {
  clientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Type de relation présélectionné (ex. "co_assure" depuis le recueil trottinette). */
  defaultType?: string;
};

export function RelatedPersonForm({ clientId, onSuccess, onCancel, defaultType }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [existingId, setExistingId] = useState("");
  const [type_relation, setTypeRelation] = useState<string>(defaultType ?? "conjoint");
  const [form, setForm] = useState({ full_name: "", date_naissance: "", email: "", phone: "", notes: "" });

  const set = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    let active = true;
    listClientOptions().then((d) => { if (active) setOptions(d.filter((o) => o.id !== clientId)); });
    return () => { active = false; };
  }, [clientId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "create" && !form.full_name.trim()) { setError("Le nom est obligatoire."); return; }
    if (mode === "existing" && !existingId) { setError("Sélectionnez un client à relier."); return; }

    startTransition(async () => {
      const result = await addRelatedPersonAction({
        client_id: clientId,
        type_relation,
        mode,
        existing_client_id: mode === "existing" ? existingId : undefined,
        full_name: mode === "create" ? form.full_name.trim() : undefined,
        date_naissance: mode === "create" ? form.date_naissance || undefined : undefined,
        email: mode === "create" ? form.email || undefined : undefined,
        phone: mode === "create" ? form.phone || undefined : undefined,
        notes: form.notes || undefined,
      });
      if (!result.success) { setError(result.error ?? "Une erreur est survenue."); return; }
      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="client-form">
      {error && <div className="form-error-banner"><X size={14} aria-hidden /> {error}</div>}

      <fieldset className="form-section">
        <legend><Users size={16} aria-hidden /> Personne liée</legend>

        {/* Choix du mode */}
        <div className="bo-ec-tabs" style={{ marginBottom: 14 }}>
          <button type="button" className={`bo-ec-tab${mode === "create" ? " is-active" : ""}`} onClick={() => setMode("create")}>
            <UserPlus size={14} aria-hidden /> Nouvelle fiche client
          </button>
          <button type="button" className={`bo-ec-tab${mode === "existing" ? " is-active" : ""}`} onClick={() => setMode("existing")}>
            <Link2 size={14} aria-hidden /> Relier un client existant
          </button>
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label htmlFor="type_relation">Type de relation <span className="required">*</span></label>
            <select id="type_relation" value={type_relation} onChange={(e) => setTypeRelation(e.target.value)}>
              {TYPES_RELATION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {mode === "existing" ? (
            <div className="form-field">
              <label htmlFor="existing_client">Client à relier <span className="required">*</span></label>
              <select id="existing_client" value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                <option value="">Sélectionnez un client…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name || o.email || o.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-field">
                <label htmlFor="related_full_name">Nom complet <span className="required">*</span></label>
                <input id="related_full_name" type="text" placeholder="Prénom Nom" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="related_dob">Date de naissance</label>
                <input id="related_dob" type="date" value={form.date_naissance} onChange={(e) => set("date_naissance", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="related_email">Email</label>
                <input id="related_email" type="email" placeholder="email@exemple.fr" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="related_phone">Téléphone</label>
                <input id="related_phone" type="tel" placeholder="06 00 00 00 00" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="related_notes">Notes</label>
          <textarea id="related_notes" rows={2} placeholder="Informations complémentaires…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <p className="bo-form-hint" style={{ marginTop: 4 }}>
          {mode === "create"
            ? "Une fiche client sera créée et reliée à ce dossier."
            : "Le client sélectionné sera relié comme personne liée à ce dossier."}
        </p>
      </fieldset>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="secondary-action" onClick={onCancel} disabled={isPending}>Annuler</button>
        )}
        <button type="submit" className="primary-action" disabled={isPending}>
          {isPending ? <><Loader2 size={16} className="spin" aria-hidden /> Enregistrement…</> : <><Plus size={16} aria-hidden /> Ajouter la personne</>}
        </button>
      </div>
    </form>
  );
}
