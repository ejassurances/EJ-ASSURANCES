"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Phone } from "lucide-react";
import { confirmPhoneConsentAction } from "@/app/actions/phone-consent";

export function PhoneConsentConfirm({ token, fullName }: { token: string; fullName?: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("loading");
    const res = await confirmPhoneConsentAction(token);
    if (res.success) {
      setState("done");
    } else {
      setError(res.error ?? "Une erreur est survenue.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="tunnel-section tunnel-section--confirmation">
        <div className="tunnel-confirmation">
          <span className="tunnel-confirmation__icon"><CheckCircle2 size={44} aria-hidden /></span>
          <h2>Merci, votre accord est enregistré</h2>
          <p className="tunnel-confirmation__sub">
            Vous avez confirmé accepter d'être recontacté par téléphone par EJ Partners Assurances.
            Vous pouvez fermer cette page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tunnel-section">
      <div className="tunnel-section__header">
        <p className="eyebrow">Consentement téléphonique</p>
        <h2>{fullName ? `Bonjour ${fullName},` : "Bonjour,"}</h2>
        <p className="tunnel-section__desc">
          Pour que le cabinet EJ Partners Assurances puisse vous recontacter <strong>par téléphone</strong>
          au sujet de votre projet, merci de confirmer votre accord ci-dessous.
        </p>
      </div>
      {state === "error" && <p className="form-error-banner">{error}</p>}
      <div className="form-actions">
        <button type="button" className="primary-action" onClick={confirm} disabled={state === "loading"}>
          {state === "loading"
            ? <><Loader2 size={16} className="spin" aria-hidden /> Enregistrement…</>
            : <><Phone size={16} aria-hidden /> Je confirme mon accord</>}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
        Sans confirmation, nous ne vous contacterons pas par téléphone.
      </p>
    </div>
  );
}
