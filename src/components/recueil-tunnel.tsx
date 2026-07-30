"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitRecueilAction, type RecueilPayload } from "@/app/actions/recueil-intake";

export type RecueilQuestion = {
  name: string;
  label: string;
  type: "select" | "text" | "number" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
};

export type RecueilConfig = {
  product: RecueilPayload["product"];
  productLabel: string;
  title: string;
  subtitle: string;
  questions: RecueilQuestion[];
};

const STEPS = ["Votre besoin", "Vos coordonnées", "Confirmation"];

export function RecueilTunnel({ config }: { config: RecueilConfig }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [identity, setIdentity] = useState({ full_name: "", email: "", phone: "" });
  const [recontact, setRecontact] = useState(false);
  const [partner, setPartner] = useState(false);
  const [phone, setPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const renderedAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);
  useEffect(() => { renderedAt.current = Date.now(); }, []);

  const setAnswer = (name: string, v: string) => setAnswers((p) => ({ ...p, [name]: v }));

  const answersSummary = useMemo(
    () =>
      config.questions
        .map((q) => {
          const raw = answers[q.name];
          if (!raw) return null;
          const label = q.options?.find((o) => o.value === raw)?.label ?? raw;
          return `${q.label} : ${label}`;
        })
        .filter(Boolean)
        .join(" · "),
    [answers, config.questions],
  );

  const step1Valid = config.questions.every((q) => !q.required || answers[q.name]);
  const step2Valid = identity.full_name.trim() && identity.email.trim();

  async function submit() {
    setError(null);
    if (!recontact) { setError("Merci d'accepter d'être recontacté par le cabinet."); return; }
    setLoading(true);
    const res = await submitRecueilAction({
      product: config.product,
      productLabel: config.productLabel,
      fullName: identity.full_name,
      email: identity.email,
      phone: identity.phone,
      answers,
      answersSummary: `${config.productLabel}. ${answersSummary}`,
      recontactConsent: recontact,
      partnerConsent: partner,
      phoneConsent: phone,
      honeypot: honeypot.current?.value || "",
      renderedAt: renderedAt.current,
    });
    setLoading(false);
    if (res.success) setDone(true);
    else setError("Envoi impossible pour le moment. Réessayez ou contactez le cabinet.");
  }

  if (done) {
    return (
      <div className="tunnel-wrapper">
        <div className="tunnel-section tunnel-section--confirmation">
          <div className="tunnel-confirmation">
            <span className="tunnel-confirmation__icon"><CheckCircle2 size={44} aria-hidden /></span>
            <h2>Votre recueil est transmis au cabinet</h2>
            <p className="tunnel-confirmation__sub">
              Merci {identity.full_name.split(" ")[0]}. Un email de confirmation vous a été envoyé
              et un conseiller EJ Partners vous recontacte rapidement pour la suite ({config.productLabel}).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tunnel-wrapper">
      {/* Anti-bot : honeypot invisible */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
        <input ref={honeypot} type="text" name="company_url" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="tunnel-progress">
        {STEPS.map((label, i) => (
          <div key={label} className={`tunnel-progress__dot${step === i + 1 ? " is-active" : ""}${step > i + 1 ? " is-done" : ""}`}>
            <span>{i + 1}</span>
            <span className="tunnel-progress__label">{label}</span>
          </div>
        ))}
      </div>

      {error && <p className="form-error-banner">{error}</p>}

      {/* Étape 1 — besoin */}
      {step === 1 && (
        <div className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">{config.title}</p>
            <h2>{config.subtitle}</h2>
            <p className="tunnel-section__desc">Quelques questions pour préparer votre étude {config.productLabel.toLowerCase()}.</p>
          </div>
          <div className="form-grid-2">
            {config.questions.map((q) => (
              <div key={q.name} className={`form-field${q.type === "textarea" ? " form-field--full" : ""}`}>
                <label>{q.label}{q.required && <span className="required"> *</span>}</label>
                {q.type === "select" ? (
                  <select className="navy-input" value={answers[q.name] ?? ""} onChange={(e) => setAnswer(q.name, e.target.value)}>
                    <option value="">Sélectionnez…</option>
                    {q.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : q.type === "textarea" ? (
                  <textarea className="navy-input" rows={3} placeholder={q.placeholder} value={answers[q.name] ?? ""} onChange={(e) => setAnswer(q.name, e.target.value)} />
                ) : (
                  <input className="navy-input" type={q.type} placeholder={q.placeholder} value={answers[q.name] ?? ""} onChange={(e) => setAnswer(q.name, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={() => setStep(2)} disabled={!step1Valid}>Continuer</button>
          </div>
        </div>
      )}

      {/* Étape 2 — coordonnées */}
      {step === 2 && (
        <div className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">Vos coordonnées</p>
            <h2>Pour vous recontacter</h2>
          </div>
          <div className="form-grid-2">
            <div className="form-field form-field--full">
              <label>Nom complet<span className="required"> *</span></label>
              <input className="navy-input" value={identity.full_name} onChange={(e) => setIdentity((p) => ({ ...p, full_name: e.target.value }))} placeholder="Prénom Nom" />
            </div>
            <div className="form-field">
              <label>Email<span className="required"> *</span></label>
              <input className="navy-input" type="email" value={identity.email} onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))} placeholder="vous@exemple.fr" />
            </div>
            <div className="form-field">
              <label>Téléphone</label>
              <input className="navy-input" type="tel" value={identity.phone} onChange={(e) => setIdentity((p) => ({ ...p, phone: e.target.value }))} placeholder="06 12 34 56 78" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(1)}>Retour</button>
            <button type="button" className="primary-action" onClick={() => setStep(3)} disabled={!step2Valid}>Continuer</button>
          </div>
        </div>
      )}

      {/* Étape 3 — récap + consentement */}
      {step === 3 && (
        <div className="tunnel-section">
          <div className="tunnel-section__header">
            <p className="eyebrow">Confirmation</p>
            <h2>Vérifiez et validez</h2>
          </div>
          <div className="form-section">
            <p style={{ fontWeight: 700, marginBottom: 6 }}>{config.productLabel}</p>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{answersSummary || "—"}</p>
            <p style={{ marginTop: 12, fontSize: 14 }}>{identity.full_name} · {identity.email}{identity.phone ? ` · ${identity.phone}` : ""}</p>
          </div>
          <label className="form-field" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={recontact} onChange={(e) => setRecontact(e.target.checked)} style={{ marginTop: 3 }} />
            <span>J'accepte d'être recontacté par EJ Partners Assurances au sujet de ma demande.</span>
          </label>
          <label className="form-field" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} style={{ marginTop: 3 }} />
            <span>J'accepte d'être recontacté <strong>par téléphone</strong> par EJ Partners Assurances au sujet de ma demande.</span>
          </label>
          <label className="form-field" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={partner} onChange={(e) => setPartner(e.target.checked)} style={{ marginTop: 3 }} />
            <span>J'accepte d'être recontacté par le cabinet ou l'un de ses partenaires. (facultatif)</span>
          </label>
          <div className="form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(2)} disabled={loading}>Retour</button>
            <button type="button" className="primary-action" onClick={submit} disabled={loading || !recontact}>
              {loading ? <><Loader2 size={16} className="spin" aria-hidden /> Envoi…</> : "Envoyer mon recueil"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
