"use client";

import { useActionState } from "react";
import { CheckCircle2, Send, UserPlus } from "lucide-react";
import { depositProspectAction, type ProspectDepositState } from "@/lib/actions/prospects";

const initialState: ProspectDepositState = { status: "idle", message: "" };

export function ProspectDepositForm() {
  const [state, formAction, pending] = useActionState(depositProspectAction, initialState);

  return (
    <div id="depot" className="bo-card">
      <div className="bo-card-h">
        <h2 style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <UserPlus size={17} aria-hidden /> Déposer un prospect
        </h2>
      </div>
      <div className="bo-card-b">
        {state.status === "success" ? (
          <div className="bo-formsuccess">
            <span className="bo-formsuccess-ic"><CheckCircle2 size={20} aria-hidden /></span>
            <p>{state.message}</p>
          </div>
        ) : (
          <form action={formAction} className="bo-form">
            {state.status === "error" && <p className="bo-formerror">{state.message}</p>}

            <div className="bo-form-row">
              <div className="bo-field">
                <label className="bo-label" htmlFor="pd-name">Nom du prospect *</label>
                <input id="pd-name" name="full_name" className="bo-input" placeholder="Prénom Nom" required />
              </div>
              <div className="bo-field">
                <label className="bo-label" htmlFor="pd-besoin">Besoin</label>
                <select id="pd-besoin" name="besoin" className="bo-input" defaultValue="emprunteur">
                  <option value="emprunteur">Assurance emprunteur</option>
                  <option value="prevoyance">Prévoyance</option>
                  <option value="sante">Complémentaire santé</option>
                  <option value="auto">Assurance auto / moto</option>
                  <option value="habitation">Assurance habitation</option>
                  <option value="autre">Autre besoin</option>
                </select>
              </div>
            </div>

            <div className="bo-form-row">
              <div className="bo-field">
                <label className="bo-label" htmlFor="pd-email">Email</label>
                <input id="pd-email" name="email" type="email" className="bo-input" placeholder="prospect@email.fr" />
              </div>
              <div className="bo-field">
                <label className="bo-label" htmlFor="pd-phone">Téléphone</label>
                <input id="pd-phone" name="phone" type="tel" className="bo-input" placeholder="06 12 34 56 78" />
              </div>
            </div>

            <div className="bo-field">
              <label className="bo-label" htmlFor="pd-msg">Message (optionnel)</label>
              <textarea id="pd-msg" name="message" className="bo-input bo-textarea" rows={3}
                placeholder="Contexte, disponibilités, informations utiles pour le cabinet…" />
            </div>

            <p className="bo-form-hint">
              Au moins un email ou un téléphone est requis pour que le cabinet puisse recontacter le prospect.
            </p>

            <div className="bo-form-actions">
              <button type="submit" className="bo-btn bo-btn-primary" disabled={pending}>
                <Send size={15} aria-hidden /> {pending ? "Transmission…" : "Transmettre au cabinet"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
