// Signature réglementaire pour les emails destinés aux clients / prospects.
// Mentions courtier en assurances (DDA / ORIAS / ACPR / médiation).
// Les champs susceptibles de changer sont pilotables par variables d'environnement ;
// à défaut, on retombe sur les valeurs connues du cabinet (ou une mention « en cours »).

export const brokerLegal = {
  name: "EJ Partners Assurances",
  status: "Courtier en assurances",
  // n° d'immatriculation ORIAS (à renseigner une fois obtenu).
  orias: process.env.BROKER_ORIAS?.trim() || "",
  // Forme juridique + capital, ex. « SAS au capital de 10 000 € ».
  legalForm: process.env.BROKER_LEGAL_FORM?.trim() || "",
  siren: process.env.BROKER_SIREN?.trim() || "",
  address: process.env.BROKER_ADDRESS?.trim() || "",
  phone: process.env.BROKER_PHONE?.trim() || "01 89 31 40 29",
  email: "contact@ej-assurances.fr",
  website: "www.ej-assurances.fr",
};

// Signature HTML (auto-suffisante, styles inline pour les clients mail).
export function legalSignatureHtml(): string {
  const b = brokerLegal;
  const orias = b.orias
    ? `Immatriculé à l'ORIAS sous le n° ${b.orias}`
    : `Immatriculation ORIAS en cours`;
  const identity = [b.legalForm, b.siren ? `SIREN ${b.siren}` : "", b.address]
    .filter(Boolean)
    .join(" · ");

  const line = 'margin:2px 0;color:#8a8a8a;font-size:11px;line-height:1.5;';
  const link = 'color:#8a8a8a;';

  return `
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e0e0e0;text-align:left;">
      <p style="margin:2px 0;color:#555;font-size:12px;font-weight:700;">${b.name} — ${b.status}</p>
      ${identity ? `<p style="${line}">${identity}</p>` : ""}
      <p style="${line}">${orias} — vérifiable sur <a href="https://www.orias.fr" style="${link}">orias.fr</a></p>
      <p style="${line}">Autorité de contrôle : ACPR, 4 Place de Budapest, CS 92459, 75436 Paris Cedex 09.</p>
      <p style="${line}">Rémunération par commissions des compagnies partenaires, sans surcoût pour le client, communiquée avant toute souscription (DDA).</p>
      <p style="${line}">Réclamation : <a href="mailto:${b.email}" style="${link}">${b.email}</a> — Médiation de l'assurance : <a href="https://www.mediation-assurance.org" style="${link}">mediation-assurance.org</a></p>
      <p style="${line}">Assurance de responsabilité civile professionnelle et garantie financière conformes à la réglementation applicable aux courtiers.</p>
      <p style="${line}">${b.phone} — <a href="https://${b.website}" style="${link}">${b.website}</a></p>
      <p style="margin:8px 0 0;color:#a3a3a3;font-size:10.5px;line-height:1.5;">Ce message et ses éventuelles pièces jointes sont confidentiels et destinés au seul destinataire. Si vous n'êtes pas concerné, merci de le supprimer.</p>
    </div>
  `;
}
