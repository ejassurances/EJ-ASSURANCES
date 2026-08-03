"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileSearch,
  Gauge,
  Landmark,
  ListChecks,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { AdminModulePage } from "@/components/admin-module-page";
import { computeLcbftScore, type LcbftInput } from "@/lib/compliance/lcbft-scoring";

type RiskLevel = "faible" | "standard" | "renforce" | "critique";
type CheckStatus = "conforme" | "a_revoir" | "alerte" | "a_faire";

type ComplianceCase = {
  id: string;
  client: string;
  profile: string;
  risk: RiskLevel;
  status: CheckStatus;
  lastCheck: string;
  nextReview: string;
  controls: string[];
  note: string;
  scoring: LcbftInput;
};

const cases: ComplianceCase[] = [
  {
    id: "LCB-001",
    client: "Dossier emprunteur - couple non marié",
    profile: "Assurance emprunteur, co-emprunteurs, résidence principale",
    risk: "standard",
    status: "conforme",
    lastCheck: "2026-06-28",
    nextReview: "2027-06-28",
    controls: ["Identité", "Bénéficiaire effectif", "PPE", "Gel des avoirs"],
    note: "Entrée en relation conforme, justificatifs présents dans le classeur ACPR.",
    scoring: { amountAboveThreshold: true, digitalOnboarding: true },
  },
  {
    id: "LCB-002",
    client: "Famille recomposée - transmission sensible",
    profile: "Assurance vie, clauses bénéficiaires, patrimoine familial",
    risk: "renforce",
    status: "a_revoir",
    lastCheck: "2026-06-14",
    nextReview: "2026-09-14",
    controls: ["Origine des fonds", "Cohérence patrimoniale", "PPE"],
    note: "Vigilance renforcée à documenter avant recommandation définitive.",
    scoring: { lifeInsuranceOrCapitalization: true, sourceOfFundsMissing: true, amountAboveThreshold: true, inconsistentProfile: true },
  },
  {
    id: "LCB-003",
    client: "Prospect protection revenus",
    profile: "Prévoyance individuelle, revenus indépendants",
    risk: "faible",
    status: "a_faire",
    lastCheck: "Non réalisé",
    nextReview: "Avant souscription",
    controls: ["Identité", "PPE", "Gel des avoirs"],
    note: "Contrôle à lancer avant tout passage en souscription.",
    scoring: { missingIdentityDocument: true, missingProofOfAddress: true, digitalOnboarding: true },
  },
  {
    id: "LCB-004",
    client: "Dossier signalé par mandataire",
    profile: "Souscription avec incohérence documentaire",
    risk: "critique",
    status: "alerte",
    lastCheck: "2026-07-02",
    nextReview: "Immédiat",
    controls: ["Gel des avoirs", "Origine des fonds", "Escalade conformité"],
    note: "Aucune décision automatique. Revue courtier responsable avant toute suite.",
    scoring: { sanctionsPotentialMatch: true, sourceOfFundsComplex: true, unusualTransaction: true, inconsistentProfile: true },
  },
];

const obligations = [
  {
    title: "Identification et connaissance client",
    text: "Collecter les éléments KYC utiles, vérifier l'identité, comprendre la situation et conserver les justificatifs nécessaires.",
    icon: UserCheck,
  },
  {
    title: "Évaluation du risque",
    text: "Attribuer un niveau de vigilance selon le client, le produit, le pays, l'origine des fonds, le canal et les signaux atypiques.",
    icon: Gauge,
  },
  {
    title: "PPE et gel des avoirs",
    text: "Contrôler les personnes politiquement exposées et les listes de sanctions avant l'entrée en relation et lors des revues.",
    icon: ShieldAlert,
  },
  {
    title: "Traçabilité conformité",
    text: "Historiser les contrôles, preuves, décisions humaines, alertes, documents consultés et éventuelles escalades.",
    icon: FileSearch,
  },
];

const workflow = [
  "Recueil des informations client et justificatifs utiles.",
  "Qualification du risque LCB-FT selon la situation et le produit.",
  "Contrôle PPE, sanctions, gel des avoirs et cohérence documentaire.",
  "Validation humaine avant recommandation, souscription ou escalade.",
  "Archivage des preuves dans le classeur ACPR et journal d'audit.",
];

const riskCopy: Record<RiskLevel, string> = {
  faible: "Faible",
  standard: "Standard",
  renforce: "Renforcé",
  critique: "Critique",
};

const statusCopy: Record<CheckStatus, string> = {
  conforme: "Conforme",
  a_revoir: "À revoir",
  alerte: "Alerte",
  a_faire: "À faire",
};

function badgeClass(prefix: string, value: string) {
  return `${prefix} ${prefix}--${value}`;
}

export default function LcbFtPage() {
  return (
    <Suspense fallback={null}>
      <LcbFtContent />
    </Suspense>
  );
}

function LcbFtContent() {
  const searchParams = useSearchParams();
  const focusClient = searchParams.get("client")?.trim() ?? "";
  const focusClientId = searchParams.get("clientId")?.trim() ?? "";
  const [query, setQuery] = useState(focusClient);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "tous">("tous");

  const filteredCases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.map((item) => ({ ...item, score: computeLcbftScore(item.scoring) })).filter((item) => {
      const matchText =
        !needle ||
        item.client.toLowerCase().includes(needle) ||
        item.profile.toLowerCase().includes(needle) ||
        item.id.toLowerCase().includes(needle);
      const matchRisk = riskFilter === "tous" || item.score.level === riskFilter;
      return matchText && matchRisk;
    });
  }, [query, riskFilter]);

  const scoredCases = cases.map((item) => ({ ...item, score: computeLcbftScore(item.scoring) }));

  const stats = {
    total: cases.length,
    alertes: cases.filter((item) => item.status === "alerte").length,
    renforces: scoredCases.filter((item) => item.score.level === "renforce" || item.score.level === "critique").length,
    aFaire: cases.filter((item) => item.status === "a_faire" || item.status === "a_revoir").length,
  };

  return (
    <AdminModulePage
      emoji="LCB"
      title="LCB-FT, PPE et gel des avoirs"
      description="Pilotage de la vigilance client, des contrôles réglementaires et des preuves de conformité."
      parentHref="/admin/conformite"
      parentLabel="Conformité"
    >
      {focusClient && (
        <div className="lcb-client-focus">
          <div>
            <span className="lcb-client-focus__label">Contrôle LCB-FT du client</span>
            <strong>{focusClient}</strong>
          </div>
          {focusClientId && (
            <Link href={`/admin/clients/${focusClientId}`} className="lcb-client-focus__back">
              <ArrowLeft size={14} aria-hidden /> Retour à la fiche
            </Link>
          )}
        </div>
      )}

      <section className="lcb-hero">
        <div>
          <p className="eyebrow">Priorité conformité</p>
          <h2>Un contrôle LCB-FT doit être documenté avant toute souscription sensible.</h2>
          <p>
            Cette V1 pose le cadre métier : niveau de vigilance, contrôles PPE et gel des avoirs,
            preuves, revue humaine et journalisation. Elle évite de laisser la conformité dans un
            simple tableau décoratif.
          </p>
        </div>
        <div className="lcb-hero__notice">
          <LockKeyhole size={20} aria-hidden />
          <strong>Garde-fou</strong>
          <span>L'IA peut alerter et préparer une synthèse, mais ne valide jamais une conformité LCB-FT.</span>
        </div>
      </section>

      <section className="lcb-kpis" aria-label="Indicateurs LCB-FT">
        <div><strong>{stats.total}</strong><span>Dossiers suivis</span></div>
        <div><strong>{stats.alertes}</strong><span>Alertes ouvertes</span></div>
        <div><strong>{stats.renforces}</strong><span>Vigilances renforcées</span></div>
        <div><strong>{stats.aFaire}</strong><span>Actions à traiter</span></div>
      </section>

      <section className="lcb-grid">
        {obligations.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="lcb-card">
              <Icon size={20} aria-hidden />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          );
        })}
      </section>

      <section className="lcb-workflow">
        <div>
          <p className="eyebrow">Workflow cabinet</p>
          <h2>Vigilance proportionnée au risque.</h2>
          <p>
            Le niveau de vigilance doit être adapté à la situation du client, au produit distribué,
            aux montants, au canal d'entrée en relation et aux incohérences éventuelles.
          </p>
        </div>
        <ol>
          {workflow.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="lcb-toolbar">
        <div className="lcb-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un dossier, profil ou identifiant"
          />
        </div>
        <div className="lcb-filter" aria-label="Filtrer par niveau de risque">
            {(["tous", "faible", "standard", "renforce", "critique"] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={riskFilter === level ? "active" : ""}
              onClick={() => setRiskFilter(level)}
            >
              {level === "tous" ? "Tous" : riskCopy[level]}
            </button>
          ))}
        </div>
      </section>

      <section className="lcb-table-card">
        <div className="lcb-table-card__header">
          <div>
            <h3>Dossiers de vigilance</h3>
            <p>Vue métier à relier ensuite aux fiches clients, projets et classeur ACPR.</p>
          </div>
          <ListChecks size={20} aria-hidden />
        </div>
        <div className="lcb-table-wrap">
          <table className="lcb-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Profil</th>
                <th>Score</th>
                <th>Vigilance</th>
                <th>Statut</th>
                <th>Contrôles</th>
                <th>Revue</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.client}</strong>
                    <span>{item.id}</span>
                  </td>
                  <td>{item.profile}</td>
                  <td>
                    <strong>{item.score.score}/100</strong>
                    <span>{item.score.decision.replaceAll("_", " ")}</span>
                  </td>
                  <td><span className={badgeClass("lcb-risk", item.score.level)}>{riskCopy[item.score.level]}</span></td>
                  <td><span className={badgeClass("lcb-status", item.status)}>{statusCopy[item.status]}</span></td>
                  <td>
                    <div className="lcb-chip-list">
                      {item.controls.map((control) => <span key={control}>{control}</span>)}
                    </div>
                  </td>
                  <td>
                    <div className="lcb-review">
                      <Clock size={13} aria-hidden />
                      <span>Dernier : {item.lastCheck}</span>
                      <span>{item.score.reviewFrequency}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lcb-table-card">
        <div className="lcb-table-card__header">
          <div>
            <h3>Automatisations déclenchées par le score</h3>
            <p>Le score ne valide pas le dossier : il déclenche des contrôles, tâches, blocages et escalades.</p>
          </div>
          <Gauge size={20} aria-hidden />
        </div>
        <div className="lcb-automation-grid">
          {scoredCases.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.client}</strong>
                <span>{item.score.score}/100 - {riskCopy[item.score.level]}</span>
              </div>
              <ul>
                {item.score.automations.map((automation) => (
                  <li key={automation.id}>
                    <b>{automation.label}</b>
                    <span>{automation.description}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="lcb-proof-grid">
        <article>
          <ShieldCheck size={20} aria-hidden />
          <h3>Preuves à conserver</h3>
          <ul>
            <li>Pièces KYC et justificatifs utiles.</li>
            <li>Résultat PPE, sanctions et gel des avoirs.</li>
            <li>Score de risque et justification.</li>
            <li>Décision humaine, date, auteur et commentaire.</li>
          </ul>
        </article>
        <article>
          <Landmark size={20} aria-hidden />
          <h3>Escalade et Tracfin</h3>
          <ul>
            <li>Blocage automatique des actions sensibles en cas d'alerte.</li>
            <li>Revue du courtier responsable avant toute décision.</li>
            <li>Journalisation de l'analyse et des sources utilisées.</li>
            <li>Procédure de déclaration de soupçon hors automatisme IA.</li>
          </ul>
        </article>
        <article>
          <AlertTriangle size={20} aria-hidden />
          <h3>Automatisation V2</h3>
          <ul>
            <li>Tables Supabase `compliance_checks` et `audit_logs`.</li>
            <li>Connecteur listes PPE / sanctions.</li>
            <li>Scoring dynamique selon typologie produit.</li>
            <li>Blocage workflow si score critique ou pièces KYC absentes.</li>
          </ul>
        </article>
      </section>
    </AdminModulePage>
  );
}
