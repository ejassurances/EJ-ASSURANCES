"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Loader2 } from "lucide-react";
import { sendClientEmailAction, listClientEmails, type ClientEmail } from "@/lib/actions/client-emails";

export function ClientEmailPanel({
  clientId,
  clientEmail,
}: {
  clientId: string;
  clientEmail?: string | null;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [emails, setEmails] = useState<ClientEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listClientEmails(clientId)
      .then((d) => { if (active) setEmails(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId]);

  async function send() {
    setError(null); setOk(false);
    if (!subject.trim() || !body.trim()) { setError("Objet et message sont obligatoires."); return; }
    setSending(true);
    const res = await sendClientEmailAction({ clientId, subject, body });
    setSending(false);
    if (!res.success) { setError(res.error ?? "Envoi impossible."); return; }
    setOk(true); setSubject(""); setBody("");
    listClientEmails(clientId).then(setEmails);
  }

  if (!clientEmail) {
    return <p className="cf360-empty">Ce contact n&apos;a pas d&apos;adresse email — ajoutez-en une pour lui écrire.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div className="cf360-inline-form">
        <p className="cf360-detail-label" style={{ marginBottom: 4 }}>À : {clientEmail}</p>
        {error && <p className="form-error-banner" style={{ marginBottom: 10 }}>{error}</p>}
        {ok && <p className="bo-formsuccess" style={{ marginBottom: 10 }}><span className="bo-formsuccess-ic"><Send size={16} aria-hidden /></span><span>Email envoyé et enregistré dans l&apos;historique.</span></p>}
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Objet</label>
          <input className="navy-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de l'email" />
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>Message</label>
          <textarea className="navy-input" rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message… (la signature réglementaire du cabinet est ajoutée automatiquement)" />
        </div>
        <div className="form-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="cf360-add-btn" onClick={send} disabled={sending}>
            {sending ? <Loader2 size={15} className="spin" aria-hidden /> : <Send size={15} aria-hidden />}
            {sending ? "Envoi…" : "Envoyer l'email"}
          </button>
        </div>
      </div>

      <div>
        <p className="cf360-detail-label" style={{ marginBottom: 8 }}>Historique des emails</p>
        {loading ? (
          <p className="cf360-empty"><Loader2 size={14} className="spin" aria-hidden /> Chargement…</p>
        ) : emails.length === 0 ? (
          <p className="cf360-empty">Aucun email envoyé pour le moment.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {emails.map((m) => (
              <div key={m.id} className="cf360-info-card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Mail size={14} aria-hidden /> {m.subject || "(sans objet)"}
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {m.body && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    {m.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
