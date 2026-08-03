"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, KeyRound, Lock, Pencil } from "lucide-react";
import {
  upsertPartnerApiIntegration,
  deletePartnerApiIntegration,
  type PartnerApiIntegration,
} from "@/lib/actions/partner-api";

const TYPOLOGIES: { value: string; label: string }[] = [
  { value: "assurance_emprunteur", label: "Assurance emprunteur" },
  { value: "prevoyance", label: "Prévoyance" },
  { value: "sante", label: "Santé" },
  { value: "assurance_vie", label: "Assurance vie" },
  { value: "protection_juridique", label: "Protection juridique" },
  { value: "trottinette", label: "Trottinette / EDPM" },
];
const typoLabel = (v: string) => TYPOLOGIES.find((t) => t.value === v)?.label ?? v;

const AUTH_MODES: { value: string; label: string }[] = [
  { value: "user_password", label: "user / password (par appel)" },
  { value: "api_key", label: "Clé API" },
  { value: "oauth2", label: "OAuth2" },
  { value: "basic", label: "Basic" },
  { value: "mtls", label: "mTLS" },
  { value: "none", label: "Non configurée" },
];
const STATUSES: { value: string; label: string }[] = [
  { value: "not_configured", label: "Non configurée" },
  { value: "requested", label: "Accès demandé" },
  { value: "sandbox_ready", label: "Sandbox prête" },
  { value: "production_ready", label: "Production prête" },
  { value: "disabled", label: "Désactivée" },
  { value: "error", label: "Erreur" },
];

const emptyDraft = (): Partial<PartnerApiIntegration> => ({
  name: "",
  typologies: [],
  protocol: "rest",
  environment: "sandbox",
  auth_mode: "user_password",
  status: "not_configured",
  endpoints: {},
  operations: [],
});

export function PartnerApiIntegrations({
  partnerId,
  integrations,
}: {
  partnerId: string;
  integrations: PartnerApiIntegration[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<PartnerApiIntegration>>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() { setDraft(emptyDraft()); setError(null); setOpen(true); }
  function startEdit(it: PartnerApiIntegration) { setDraft({ ...it }); setError(null); setOpen(true); }

  function toggleTypo(v: string) {
    setDraft((d) => {
      const cur = new Set(d.typologies ?? []);
      if (cur.has(v)) cur.delete(v); else cur.add(v);
      return { ...d, typologies: [...cur] };
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("partnerId", partnerId);
    if (draft.id) form.set("id", draft.id);
    (draft.typologies ?? []).forEach((t) => form.append("typologies", t));
    setSaving(true);
    const res = await upsertPartnerApiIntegration(form);
    setSaving(false);
    if (!res.success) { setError(res.error ?? "Enregistrement impossible."); return; }
    setOpen(false);
    router.refresh();
  }

  async function remove(it: PartnerApiIntegration) {
    if (!confirm(`Supprimer l'intégration « ${it.name} » ?`)) return;
    const res = await deletePartnerApiIntegration(it.id, partnerId);
    if (res.success) router.refresh();
  }

  const isSoap = draft.protocol === "soap";

  return (
    <section className="pt-api">
      <div className="pt-sec-head">
        <div><p className="pt-eyebrow">Intégrations</p><h2>Intégrations API</h2></div>
        <div className="pt-sec-head-r">
          <span className="pt-count">{integrations.length}</span>
          <button type="button" className="pt-add" onClick={startAdd}><Plus size={14} aria-hidden /> Ajouter une intégration</button>
        </div>
      </div>

      {integrations.length === 0 ? (
        <div className="pt-empty">Aucune intégration API. Ajoutez-en une pour connecter les devis/souscription de ce partenaire.</div>
      ) : (
        <div className="pt-api-grid">
          {integrations.map((it) => (
            <article key={it.id} className="pt-api-card">
              <div className="pt-api-top">
                <div>
                  <div className="pt-api-name">{it.name}</div>
                  <div className="pt-chips">
                    <span className="pt-chip proto">{it.protocol.toUpperCase()}</span>
                    {(it.typologies ?? []).map((t) => <span key={t} className="pt-chip ty">{typoLabel(t)}</span>)}
                    <span className="pt-chip env">{it.environment === "production" ? "Production" : it.environment === "sandbox" ? "Recette" : "À confirmer"}</span>
                  </div>
                </div>
                <div className="pt-api-card-actions">
                  <button type="button" onClick={() => startEdit(it)} title="Modifier"><Pencil size={14} aria-hidden /></button>
                  <button type="button" onClick={() => remove(it)} title="Supprimer"><Trash2 size={14} aria-hidden /></button>
                </div>
              </div>
              <div className="pt-api-kvs">
                {it.base_url && <div className="pt-kv"><span className="k">URL</span><span className="v">{it.base_url}</span></div>}
                {it.wsdl_url && <div className="pt-kv"><span className="k">WSDL</span><span className="v">{it.wsdl_url}</span></div>}
                <div className="pt-kv"><span className="k">Auth</span><span className="v">{AUTH_MODES.find((a) => a.value === it.auth_mode)?.label ?? it.auth_mode}</span></div>
                {it.operations?.length > 0 && <div className="pt-kv"><span className="k">Opérations</span><span className="v">{it.operations.join(" · ")}</span></div>}
                {it.endpoints?.quote && <div className="pt-kv"><span className="k">Endpoint devis</span><span className="v">{it.endpoints.quote}</span></div>}
                {it.secret_env_var && <div className="pt-kv"><span className="k">Secret</span><span className="v">env {it.secret_env_var}</span></div>}
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <form className="pt-api-form" onSubmit={submit}>
          <h3><KeyRound size={15} aria-hidden /> {draft.id ? "Modifier l'intégration" : "Nouvelle intégration API"}</h3>
          {error && <p className="bo-formerror">{error}</p>}

          <div className="pt-fg">
            <label>Nom de l&apos;intégration</label>
            <input name="name" defaultValue={draft.name ?? ""} placeholder="Ex : UTWIN — Devis emprunteur" required />
          </div>

          <div className="pt-fg">
            <label>Typologies couvertes <span className="pt-hl">(une API peut en couvrir plusieurs)</span></label>
            <div className="pt-multi">
              {TYPOLOGIES.map((t) => (
                <label key={t.value} className={(draft.typologies ?? []).includes(t.value) ? "on" : ""}>
                  <input type="checkbox" checked={(draft.typologies ?? []).includes(t.value)} onChange={() => toggleTypo(t.value)} /> {t.label}
                </label>
              ))}
            </div>
            <p className="pt-hint">Distingue quelles typologies passent par cette API — les autres restent manuelles ou sur une autre intégration.</p>
          </div>

          <div className="pt-row">
            <div className="pt-fg">
              <label>Protocole</label>
              <select name="protocol" defaultValue={draft.protocol ?? "rest"} onChange={(e) => setDraft((d) => ({ ...d, protocol: e.target.value as "rest" | "soap" }))}>
                <option value="rest">REST</option>
                <option value="soap">SOAP</option>
              </select>
            </div>
            <div className="pt-fg">
              <label>Environnement</label>
              <select name="environment" defaultValue={draft.environment ?? "sandbox"}>
                <option value="production">Production</option>
                <option value="sandbox">Recette</option>
                <option value="unknown">À confirmer</option>
              </select>
            </div>
          </div>

          <div className="pt-cond">
            <p className="pt-sub">{isSoap ? "Champs SOAP" : "Champs REST"}</p>
            <div className="pt-fg">
              <label>{isSoap ? "URL du service" : "Base URL"}</label>
              <input name="baseUrl" defaultValue={draft.base_url ?? ""} placeholder={isSoap ? "https://webservice.utwin.fr/devisutwin.svc" : "https://api.exemple.fr/v1"} />
            </div>
            {isSoap ? (
              <>
                <div className="pt-fg"><label>WSDL</label><input name="wsdlUrl" defaultValue={draft.wsdl_url ?? ""} placeholder="…/devisutwin.svc?wsdl" /></div>
                <div className="pt-fg"><label>Opérations</label><input name="operations" defaultValue={(draft.operations ?? []).join(", ")} placeholder="GETTARIF, SETTRANSMISSION" /></div>
              </>
            ) : (
              <div className="pt-row">
                <div className="pt-fg"><label>Endpoint devis</label><input name="quoteEndpoint" defaultValue={draft.endpoints?.quote ?? ""} placeholder="/quotes" /></div>
                <div className="pt-fg"><label>Endpoint souscription</label><input name="subscriptionEndpoint" defaultValue={draft.endpoints?.subscription ?? ""} placeholder="/subscriptions" /></div>
              </div>
            )}
          </div>

          <div className="pt-row">
            <div className="pt-fg">
              <label>Mode d&apos;authentification</label>
              <select name="authMode" defaultValue={draft.auth_mode ?? "user_password"}>
                {AUTH_MODES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="pt-fg">
              <label>Identifiant (login / code courtier)</label>
              <input name="loginIdentifier" defaultValue={draft.login_identifier ?? ""} placeholder="Code courtier" />
            </div>
          </div>

          <div className="pt-cond">
            <p className="pt-sub"><Lock size={12} aria-hidden /> Emplacement du secret (jamais le secret)</p>
            <div className="pt-fg">
              <label>Variable d&apos;environnement contenant le mot de passe / la clé</label>
              <input name="secretEnvVar" defaultValue={draft.secret_env_var ?? ""} placeholder="UTWIN_WS_PASSWORD" />
            </div>
          </div>

          <div className="pt-fg">
            <label>Statut</label>
            <select name="status" defaultValue={draft.status ?? "not_configured"}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="pt-fg">
            <label>Notes</label>
            <textarea name="notes" rows={2} defaultValue={draft.notes ?? ""} placeholder="Identifiants différents entre recette et production…" />
          </div>

          <p className="pt-warn"><Lock size={12} aria-hidden /> Ne jamais saisir de mot de passe ou de clé ici. On enregistre uniquement la configuration + le nom de la variable d&apos;environnement.</p>

          <div className="pt-form-actions">
            <button type="button" className="pt-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            <button type="submit" className="pt-add" disabled={saving}>
              {saving ? <Loader2 size={14} className="bo-spin" aria-hidden /> : null} Enregistrer l&apos;intégration
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
