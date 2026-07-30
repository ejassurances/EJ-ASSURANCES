"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AcprDocument, ClientAcprFolder } from "@/components/client-acpr-folder";
import { CurrentUser } from "@/lib/auth";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  ShieldCheck, FolderOpen, FileCheck, Lock, Clock,
  FileSignature, ExternalLink, PenLine,
} from "lucide-react";

type Tab = "documents" | "lettres" | "conformite";

export type LettreMissionSummary = {
  id: string;
  reference: string;
  product: string;
  status: string;
  created_at: string;
};

interface Props {
  acprDocuments: AcprDocument[];
  lettres: LettreMissionSummary[];
  user: CurrentUser;
}

const PRODUCT_LABEL: Record<string, string> = {
  emprunteur: "Assurance emprunteur",
  trottinette: "Assurance trottinette",
  professionnel: "Assurance professionnelle",
  prevoyance: "Prévoyance",
  patrimoine: "Assurance-vie & patrimoine",
  autre: "Assurance",
};

// Statut espace client → ton/label du StatusBadge partagé.
const CLIENT_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  signe: { tone: "success", label: "Signé" },
  en_attente: { tone: "warning", label: "En attente" },
  expire: { tone: "danger", label: "Expiré" },
  conforme: { tone: "info", label: "Conforme" },
  alerte: { tone: "danger", label: "À vérifier" },
  en_cours: { tone: "info", label: "En cours" },
};

function ClientBadge({ status }: { status: string }) {
  const cfg = CLIENT_STATUS[status] ?? { tone: "neutral" as StatusTone, label: status };
  return <StatusBadge tone={cfg.tone} label={cfg.label} />;
}

const CONSENTEMENTS = [
  { id: "1", type: "Recueil des besoins (DDA)", date: "2025-01-15", status: "signe" },
  { id: "2", type: "Consentement traitement données (RGPD)", date: "2025-01-15", status: "signe" },
  { id: "3", type: "Devoir de conseil — Assurance emprunteur", date: "2025-03-02", status: "signe" },
  { id: "4", type: "Renouvellement annuel du consentement", date: "2026-01-15", status: "en_attente" },
];

const DOCS_SIGNES = [
  { id: "1", nom: "Fiche de recueil des besoins 2025", date: "2025-01-15", type: "DDA" },
  { id: "2", nom: "Rapport de conseil personnalisé", date: "2025-03-02", type: "DDA" },
  { id: "3", nom: "Information précontractuelle (IPID)", date: "2025-03-02", type: "DDA" },
];

const VERIFICATIONS = [
  { id: "1", type: "Vérification d'identité (KYC)", date: "2025-01-15", resultat: "conforme" },
  { id: "2", type: "Screening PPE (Personnes Politiquement Exposées)", date: "2025-01-15", resultat: "conforme" },
  { id: "3", type: "Contrôle listes gel des avoirs (Trésor, UE, ONU)", date: "2025-01-15", resultat: "conforme" },
];

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bo-ec-card">
      <div className="bo-ec-card-h">
        <span className="bo-ec-dot"><Icon size={16} aria-hidden /></span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Row({ label, sub, right }: {
  label: string; sub?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="bo-ec-row">
      <div>
        <p className="bo-ec-lab">{label}</p>
        {sub && <p className="bo-ec-rsub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function ClientDashboard({ acprDocuments, lettres, user }: Props) {
  const [tab, setTab] = useState<Tab>("documents");
  const firstName = user.fullName.split(" ")[0];

  // Lettres non signées → carte « à signer » mise en avant.
  const pending = lettres.filter((l) => l.status !== "signee");
  const nextToSign = pending[0] ?? null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "documents", label: "Mes documents", icon: FolderOpen },
    { id: "lettres", label: "Lettres de mission", icon: FileSignature },
    { id: "conformite", label: "Conformité", icon: ShieldCheck },
  ];

  return (
    <AppShell role="client" user={user}>
      <h1 className="bo-ec-hello">Bonjour {firstName} 👋</h1>
      <p className="bo-ec-sub">Votre espace personnel EJ Partners — documents, signatures et conformité.</p>

      {nextToSign && (
        <div className="bo-ec-sign">
          <span className="bo-ec-sign-ic"><PenLine size={22} aria-hidden /></span>
          <div>
            <h2>{pending.length} document{pending.length > 1 ? "s" : ""} à signer</h2>
            <p>{PRODUCT_LABEL[nextToSign.product] ?? nextToSign.product} · {nextToSign.reference}</p>
          </div>
          <Link className="bo-ec-sign-btn" href={`/client/lettre-mission/${nextToSign.id}`}>
            Signer maintenant <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      )}

      <div className="bo-ec-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`bo-ec-tab${tab === id ? " is-active" : ""}`}>
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "documents" && <ClientAcprFolder documents={acprDocuments} />}

      {tab === "lettres" && (
        <SectionCard icon={FileSignature} title="Lettres de mission">
          {lettres.length === 0 ? (
            <Row
              label="Aucune lettre de mission pour le moment"
              sub="Votre conseiller vous transmettra une lettre de mission à signer dès qu'un projet sera lancé."
            />
          ) : (
            lettres.map((lettre) => (
              <Row
                key={lettre.id}
                label={PRODUCT_LABEL[lettre.product] ?? lettre.product}
                sub={`${lettre.reference} · ${new Date(lettre.created_at).toLocaleDateString("fr-FR")}`}
                right={
                  <span className="bo-ec-right">
                    <ClientBadge status={lettre.status === "signee" ? "signe" : "en_attente"} />
                    <Link href={`/client/lettre-mission/${lettre.id}`} className="bo-ec-link">
                      {lettre.status === "signee" ? "Consulter" : "Signer"} <ExternalLink size={13} aria-hidden />
                    </Link>
                  </span>
                }
              />
            ))
          )}
        </SectionCard>
      )}

      {tab === "conformite" && (
        <div style={{ display: "grid", gap: "18px" }}>
          <SectionCard icon={FileCheck} title="Consentements & devoir de conseil (DDA)">
            {CONSENTEMENTS.map((item) => (
              <Row key={item.id} label={item.type}
                sub={`Daté du ${new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`}
                right={<ClientBadge status={item.status} />}
              />
            ))}
          </SectionCard>

          <SectionCard icon={Lock} title="Documents remis & signés">
            {DOCS_SIGNES.map((doc) => (
              <Row key={doc.id} label={doc.nom}
                sub={`${doc.type} · ${new Date(doc.date).toLocaleDateString("fr-FR")}`}
                right={<StatusBadge tone="success" label="Remis" />}
              />
            ))}
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="Vérifications réglementaires (LCB-FT)">
            {VERIFICATIONS.map((v) => (
              <Row key={v.id} label={v.type}
                sub={
                  <span>
                    <Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} aria-hidden />
                    Effectué le {new Date(v.date).toLocaleDateString("fr-FR")}
                  </span>
                }
                right={<ClientBadge status={v.resultat} />}
              />
            ))}
          </SectionCard>

          <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0 }}>
            Ces vérifications sont effectuées par votre conseiller dans le respect des obligations
            LCB-FT imposées aux intermédiaires d&apos;assurance. Pour toute question :{" "}
            <a href="mailto:contact@ej-assurances.fr" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>
              contact@ej-assurances.fr
            </a>
          </p>
        </div>
      )}
    </AppShell>
  );
}
