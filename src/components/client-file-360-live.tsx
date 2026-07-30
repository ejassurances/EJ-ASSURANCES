"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContractForm } from "@/components/forms/contract-form";
import { InteractionForm } from "@/components/forms/interaction-form";
import { RelatedPersonForm } from "@/components/forms/related-person-form";
import { ClientProjectWorkflow } from "@/components/client-project-workflow";
import { ClientPortalInviteButton } from "@/components/client-portal-invite-button";
import { deleteContract } from "@/lib/actions/contracts";
import { deleteInteraction, deleteRelatedPerson } from "@/lib/actions/interactions";
import { StatusBadge } from "@/components/ui/status-badge";
import { clientStatus, contractStatus } from "@/components/ui/status-maps";
import type { BorrowerProject } from "@/lib/project-workflow";
import {
  FileText, Users, MessageSquare, Phone, Mail, Calendar, Video,
  StickyNote, Plus, Trash2, Shield, ChevronDown, ChevronUp,
  Building2, User, MapPin, Tag, Edit3,
  Clock, CheckCircle2, BriefcaseBusiness
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Client = Record<string, unknown> & {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  family_context?: string | null;
  notes?: string | null;
  statut_client?: string;
  situation_familiale?: string;
  date_naissance?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  source_acquisition?: string;
  score_protection?: number;
  profile_id?: string | null;
  supabase_user_id?: string | null;
  invite_sent_at?: string | null;
};

type Contract = {
  id: string;
  contract_number?: string | null;
  insurer_name?: string | null;
  contract_type: string;
  status: string;
  effective_date?: string | null;
  end_date?: string | null;
  prime_annuelle?: number | null;
  taux_commission?: number | null;
  montant_commission_annuel?: number | null;
  beneficiaires?: string | null;
  notes?: string | null;
};

type Interaction = {
  id: string;
  type: string;
  titre: string;
  contenu?: string | null;
  duree_minutes?: number | null;
  created_at: string;
  profiles?: { full_name?: string | null } | null;
};

type RelatedPerson = {
  id: string;
  type_relation: string;
  full_name: string;
  date_naissance?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type DriveDocument = {
  id: string;
  file_name: string;
  file_url?: string | null;
  document_type: string;
  nomenclature_status: string;
  status: string;
  detected_at: string;
};

type Props = {
  clientId: string;
  initialData: {
    client: Client;
    tags: string[];
    related_persons: RelatedPerson[];
    interactions: Interaction[];
    contracts: Contract[];
    projects: BorrowerProject[];
    drive_documents?: DriveDocument[];
  };
};

const TABS = [
  { id: "synthese",      label: "Synthèse",         icon: Shield },
  { id: "projets",       label: "Projets",           icon: BriefcaseBusiness },
  { id: "interactions",  label: "Interactions",      icon: MessageSquare },
  { id: "contrats",      label: "Contrats",          icon: FileText },
  { id: "documents",     label: "Documents",         icon: FileText },
  { id: "personnes",     label: "Famille",           icon: Users },
  { id: "notes",         label: "Notes",             icon: StickyNote },
] as const;

const INTERACTION_ICONS: Record<string, React.ElementType> = {
  appel: Phone, email: Mail, rdv: Calendar, visio: Video,
  note: StickyNote, sms: MessageSquare, document: FileText,
};

const INTERACTION_COLORS: Record<string, string> = {
  appel: "#3b82f6", email: "#8b5cf6", rdv: "#10b981",
  visio: "#06b6d4", note: "#f59e0b", sms: "#ec4899", document: "#6b7280",
};

// Statuts sémantiques DES-001 : succès / attention / danger / neutre.
const RELATION_LABELS: Record<string, string> = {
  conjoint: "Conjoint(e) / Partenaire",
  enfant: "Enfant",
  parent_social: "Parent social",
  co_parent: "Co-parent",
  autre: "Autre",
};

const RELATION_COLORS: Record<string, string> = {
  conjoint: "linear-gradient(135deg,#b8860b,#d4a017)",
  enfant: "linear-gradient(135deg,#1a4a3a,#2d7a5f)",
  parent_social: "linear-gradient(135deg,#1e3a5f,#2d5a8e)",
  co_parent: "linear-gradient(135deg,#4a1a6b,#7c3aed)",
  autre: "linear-gradient(135deg,#374151,#6b7280)",
};

export function ClientFile360Live({ clientId, initialData }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("synthese");
  const [showContractForm, setShowContractForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  const { client, tags, related_persons, interactions, contracts, projects, drive_documents = [] } = initialData;
  const activeContracts = contracts.filter((c) => c.status === "active");
  const score = (client.score_protection as number | undefined) ?? 0;
  const statut_client = (client.statut_client as string | undefined) ?? "prospect";
  const statusCfg = clientStatus[statut_client] ?? clientStatus.prospect;

  const handleDeleteContract = async (id: string) => {
    if (!confirm("Supprimer ce contrat ?")) return;
    await deleteContract(id, clientId);
    router.refresh();
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!confirm("Supprimer cette interaction ?")) return;
    await deleteInteraction(id, clientId);
    router.refresh();
  };

  const handleDeletePerson = async (id: string) => {
    if (!confirm("Supprimer cette personne liée ?")) return;
    await deleteRelatedPerson(id, clientId);
    router.refresh();
  };

  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtEuro = (n?: number | null) =>
    n != null ? n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—";
  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="cf360">

      {/* ── Hero Header ── */}
      <div className="cf360-hero">
        <div className="cf360-hero-avatar">
          {initials(client.full_name ?? "?")}
        </div>
        <div className="cf360-hero-info">
          <div className="cf360-hero-name-row">
            <h2 className="cf360-hero-name">{client.full_name ?? "Client sans nom"}</h2>
            <StatusBadge tone={statusCfg.tone} label={statusCfg.label} />
          </div>
          <div className="cf360-hero-meta">
            {client.email && (
              <a href={`mailto:${client.email}`} className="cf360-hero-meta-item">
                <Mail size={13} aria-hidden /> {client.email as string}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="cf360-hero-meta-item">
                <Phone size={13} aria-hidden /> {client.phone as string}
              </a>
            )}
            {client.family_context && (
              <span className="cf360-hero-meta-item cf360-hero-context">
                {client.family_context as string}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="cf360-hero-tags">
              {tags.map((tag) => (
                <span key={tag} className="cf360-hero-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="cf360-hero-actions">
          <ClientPortalInviteButton
            clientId={clientId}
            email={client.email}
            inviteSentAt={client.invite_sent_at}
            hasPortalAccount={Boolean(client.profile_id || client.supabase_user_id)}
          />
          <Link href={`/admin/clients/${clientId}/modifier`} className="cf360-edit-btn">
            <Edit3 size={14} aria-hidden /> Modifier
          </Link>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="cf360-kpis">
        <div className="cf360-kpi">
          <div className="cf360-kpi-icon" style={{ background: "#E4F1F1", color: "#1F7A80" }}>
            <FileText size={18} aria-hidden />
          </div>
          <div>
            <span className="cf360-kpi-val">{activeContracts.length}</span>
            <span className="cf360-kpi-lbl">Contrats actifs</span>
          </div>
        </div>
        <div className="cf360-kpi">
          <div className="cf360-kpi-icon" style={{ background: "#E4F1F1", color: "#1F7A80" }}>
            <MessageSquare size={18} aria-hidden />
          </div>
          <div>
            <span className="cf360-kpi-val">{interactions.length}</span>
            <span className="cf360-kpi-lbl">Interactions</span>
          </div>
        </div>
        <div className="cf360-kpi">
          <div className="cf360-kpi-icon" style={{ background: "#E4F1F1", color: "#1F7A80" }}>
            <Users size={18} aria-hidden />
          </div>
          <div>
            <span className="cf360-kpi-val">{related_persons.length}</span>
            <span className="cf360-kpi-lbl">Personnes liées</span>
          </div>
        </div>
        <div className="cf360-kpi">
          <div className="cf360-kpi-icon" style={{ background: score >= 70 ? "#E3F2EA" : score >= 40 ? "#FBF0D8" : "#FBE7E4", color: score >= 70 ? "#0F7B5A" : score >= 40 ? "#A9721B" : "#BE3A2B" }}>
            <Shield size={18} aria-hidden />
          </div>
          <div>
            <span className="cf360-kpi-val">{score}<small>/100</small></span>
            <span className="cf360-kpi-lbl">Score protection</span>
          </div>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="cf360-tabs-wrap">
        <nav className="cf360-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`cf360-tab${activeTab === id ? " cf360-tab--active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} aria-hidden />
              <span>{label}</span>
              {id === "contrats" && contracts.length > 0 && (
                <span className="cf360-tab-badge">{contracts.length}</span>
              )}
              {id === "documents" && drive_documents.length > 0 && (
                <span className="cf360-tab-badge">{drive_documents.length}</span>
              )}
              {id === "projets" && projects.length > 0 && (
                <span className="cf360-tab-badge">{projects.length}</span>
              )}
              {id === "interactions" && interactions.length > 0 && (
                <span className="cf360-tab-badge">{interactions.length}</span>
              )}
              {id === "personnes" && related_persons.length > 0 && (
                <span className="cf360-tab-badge">{related_persons.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Contenu des onglets ── */}
      <div className="cf360-panel">

        {/* SYNTHÈSE */}
        {activeTab === "synthese" && (
          <div className="cf360-synthese">
            <div className="cf360-synthese-grid">
              <div className="cf360-info-card">
                <div className="cf360-info-card-header">
                  <User size={15} aria-hidden />
                  <span>Identité</span>
                </div>
                <dl className="cf360-dl">
                  <dt>Nom complet</dt><dd>{client.full_name ?? "—"}</dd>
                  <dt>Date de naissance</dt><dd>{fmt(client.date_naissance as string | undefined)}</dd>
                  <dt>Situation familiale</dt><dd>{(client.situation_familiale as string | undefined) ?? "—"}</dd>
                  <dt>Source</dt><dd>{(client.source_acquisition as string | undefined) ?? "—"}</dd>
                </dl>
              </div>

              <div className="cf360-info-card">
                <div className="cf360-info-card-header">
                  <MapPin size={15} aria-hidden />
                  <span>Coordonnées</span>
                </div>
                <dl className="cf360-dl">
                  <dt>Email</dt>
                  <dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email as string}</a> : "—"}</dd>
                  <dt>Téléphone</dt>
                  <dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone as string}</a> : "—"}</dd>
                  <dt>Adresse</dt><dd>{(client.adresse as string | undefined) ?? "—"}</dd>
                  <dt>Ville</dt>
                  <dd>
                    {(client.code_postal as string | undefined) && (client.ville as string | undefined)
                      ? `${client.code_postal as string} ${client.ville as string}`
                      : (client.ville as string | undefined) ?? "—"}
                  </dd>
                </dl>
              </div>

              {client.family_context && (
                <div className="cf360-info-card cf360-info-card--full">
                  <div className="cf360-info-card-header">
                    <Users size={15} aria-hidden />
                    <span>Contexte familial</span>
                  </div>
                  <p className="cf360-context-text">{client.family_context as string}</p>
                </div>
              )}
            </div>

            {/* Contrats actifs en résumé */}
            {activeContracts.length > 0 && (
              <div className="cf360-synthese-section">
                <div className="cf360-section-header">
                  <CheckCircle2 size={15} style={{ color: "#0F7B5A" }} aria-hidden />
                  <span>Contrats actifs</span>
                </div>
                <div className="cf360-contracts-summary">
                  {activeContracts.map((c) => (
                    <div key={c.id} className="cf360-contract-summary-item">
                      <span className="cf360-contract-summary-type">{c.contract_type}</span>
                      <span className="cf360-contract-summary-insurer">{c.insurer_name ?? "—"}</span>
                      {c.prime_annuelle && (
                        <span className="cf360-contract-summary-prime">{fmtEuro(c.prime_annuelle)}/an</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dernière interaction */}
            {interactions.length > 0 && (
              <div className="cf360-synthese-section">
                <div className="cf360-section-header">
                  <MessageSquare size={15} style={{ color: "#3b82f6" }} aria-hidden />
                  <span>Dernière interaction</span>
                </div>
                <div className="cf360-last-interaction">
                  <span
                    className="cf360-interaction-type-pill"
                    style={{ background: `${INTERACTION_COLORS[interactions[0].type] ?? "#6b7280"}20`, color: INTERACTION_COLORS[interactions[0].type] ?? "#6b7280" }}
                  >
                    {interactions[0].type}
                  </span>
                  <span className="cf360-last-interaction-title">{interactions[0].titre}</span>
                  <span className="cf360-last-interaction-date">{fmt(interactions[0].created_at)}</span>
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="cf360-synthese-section">
                <div className="cf360-section-header">
                  <Tag size={15} aria-hidden />
                  <span>Tags</span>
                </div>
                <div className="cf360-tags-wrap">
                  {tags.map((tag) => (
                    <span key={tag} className="cf360-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROJETS */}
        {activeTab === "projets" && (
          <div className="cf360-tab-content">
            <ClientProjectWorkflow clientId={clientId} projects={projects} />
          </div>
        )}

        {/* INTERACTIONS */}
        {activeTab === "interactions" && (
          <div className="cf360-tab-content">
            <div className="cf360-tab-toolbar">
              <span className="cf360-tab-count">{interactions.length} interaction{interactions.length !== 1 ? "s" : ""}</span>
              <button className="cf360-add-btn" onClick={() => setShowInteractionForm(!showInteractionForm)}>
                <Plus size={14} aria-hidden /> Ajouter
              </button>
            </div>

            {showInteractionForm && (
              <div className="cf360-inline-form">
                <InteractionForm
                  clientId={clientId}
                  onSuccess={() => { setShowInteractionForm(false); router.refresh(); }}
                  onCancel={() => setShowInteractionForm(false)}
                />
              </div>
            )}

            {interactions.length === 0 ? (
              <div className="cf360-empty">
                <MessageSquare size={36} aria-hidden />
                <p>Aucune interaction enregistrée.</p>
                <button className="cf360-add-btn" onClick={() => setShowInteractionForm(true)}>
                  <Plus size={14} aria-hidden /> Ajouter la première interaction
                </button>
              </div>
            ) : (
              <div className="cf360-timeline">
                {interactions.map((interaction) => {
                  const Icon = INTERACTION_ICONS[interaction.type] ?? StickyNote;
                  const color = INTERACTION_COLORS[interaction.type] ?? "#6b7280";
                  const isExpanded = expandedInteraction === interaction.id;
                  return (
                    <div key={interaction.id} className="cf360-timeline-item">
                      <div className="cf360-timeline-line" aria-hidden />
                      <div
                        className="cf360-timeline-dot"
                        style={{ background: `${color}20`, color, borderColor: `${color}40` }}
                      >
                        <Icon size={13} aria-hidden />
                      </div>
                      <div className="cf360-timeline-content">
                        <div
                          className="cf360-timeline-header"
                          onClick={() => setExpandedInteraction(isExpanded ? null : interaction.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && setExpandedInteraction(isExpanded ? null : interaction.id)}
                        >
                          <span
                            className="cf360-interaction-type-pill"
                            style={{ background: `${color}15`, color }}
                          >
                            {interaction.type}
                          </span>
                          <span className="cf360-timeline-title">{interaction.titre}</span>
                          <div className="cf360-timeline-meta">
                            <span className="cf360-timeline-date">
                              <Clock size={11} aria-hidden /> {fmt(interaction.created_at)}
                            </span>
                            {interaction.duree_minutes && (
                              <span className="cf360-timeline-duration">{interaction.duree_minutes} min</span>
                            )}
                          </div>
                          <div className="cf360-timeline-actions">
                            {interaction.contenu && (
                              isExpanded
                                ? <ChevronUp size={13} aria-hidden />
                                : <ChevronDown size={13} aria-hidden />
                            )}
                            <button
                              className="cf360-delete-btn"
                              onClick={(e) => { e.stopPropagation(); handleDeleteInteraction(interaction.id); }}
                              aria-label="Supprimer"
                            >
                              <Trash2 size={12} aria-hidden />
                            </button>
                          </div>
                        </div>
                        {isExpanded && interaction.contenu && (
                          <div className="cf360-timeline-body">{interaction.contenu}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="cf360-section">
            <div className="cf360-section-header">
              <FileText size={15} aria-hidden />
              <span>Documents synchronises Drive</span>
            </div>
            {drive_documents.length === 0 ? (
              <div className="cf360-empty">
                Aucun document Drive rattache a cette fiche client pour le moment.
              </div>
            ) : (
              <div className="cf360-list">
                {drive_documents.map((document) => (
                  <div key={document.id} className="cf360-list-item">
                    <div>
                      <strong>{document.file_name}</strong>
                      <small>
                        {document.document_type} - nomenclature {document.nomenclature_status} - {fmt(document.detected_at)}
                      </small>
                    </div>
                    {document.file_url && (
                      <a className="cf360-add-btn" href={document.file_url} target="_blank" rel="noreferrer">
                        Ouvrir Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTRATS */}
        {activeTab === "contrats" && (
          <div className="cf360-tab-content">
            <div className="cf360-tab-toolbar">
              <span className="cf360-tab-count">{contracts.length} contrat{contracts.length !== 1 ? "s" : ""}</span>
              <button className="cf360-add-btn" onClick={() => setShowContractForm(!showContractForm)}>
                <Plus size={14} aria-hidden /> Nouveau contrat
              </button>
            </div>

            {showContractForm && (
              <div className="cf360-inline-form">
                <ContractForm
                  mode="create"
                  clientId={clientId}
                  onSuccess={() => { setShowContractForm(false); router.refresh(); }}
                  onCancel={() => setShowContractForm(false)}
                />
              </div>
            )}

            {contracts.length === 0 ? (
              <div className="cf360-empty">
                <FileText size={36} aria-hidden />
                <p>Aucun contrat enregistré.</p>
                <button className="cf360-add-btn" onClick={() => setShowContractForm(true)}>
                  <Plus size={14} aria-hidden /> Créer le premier contrat
                </button>
              </div>
            ) : (
              <div className="cf360-contracts-list">
                {contracts.map((contract) => {
                  const s = contractStatus[contract.status] ?? contractStatus.draft;
                  return (
                    <div key={contract.id} className="cf360-contract-card">
                      <div className="cf360-contract-card-top">
                        <div className="cf360-contract-card-left">
                          <div className="cf360-contract-icon">
                            <FileText size={16} aria-hidden />
                          </div>
                          <div>
                            <span className="cf360-contract-type">{contract.contract_type}</span>
                            <span className="cf360-contract-insurer">
                              <Building2 size={11} aria-hidden /> {contract.insurer_name ?? "—"}
                            </span>
                          </div>
                        </div>
                        <div className="cf360-contract-card-right">
                          <StatusBadge tone={s.tone} label={s.label} />
                          <button
                            className="cf360-delete-btn"
                            onClick={() => handleDeleteContract(contract.id)}
                            aria-label="Supprimer le contrat"
                          >
                            <Trash2 size={13} aria-hidden />
                          </button>
                        </div>
                      </div>
                      <div className="cf360-contract-details">
                        <div className="cf360-contract-detail-item">
                          <span className="cf360-detail-label">N° contrat</span>
                          <span className="cf360-detail-val">{contract.contract_number ?? "—"}</span>
                        </div>
                        <div className="cf360-contract-detail-item">
                          <span className="cf360-detail-label">Date d'effet</span>
                          <span className="cf360-detail-val">{fmt(contract.effective_date)}</span>
                        </div>
                        <div className="cf360-contract-detail-item">
                          <span className="cf360-detail-label">Prime annuelle</span>
                          <span className="cf360-detail-val cf360-detail-prime">{fmtEuro(contract.prime_annuelle)}</span>
                        </div>
                        <div className="cf360-contract-detail-item">
                          <span className="cf360-detail-label">Commission</span>
                          <span className="cf360-detail-val">
                            {contract.taux_commission ? `${contract.taux_commission}%` : "—"}
                            {contract.montant_commission_annuel ? ` · ${fmtEuro(contract.montant_commission_annuel)}/an` : ""}
                          </span>
                        </div>
                        {contract.beneficiaires && (
                          <div className="cf360-contract-detail-item cf360-contract-detail-full">
                            <span className="cf360-detail-label">Bénéficiaires</span>
                            <span className="cf360-detail-val">{contract.beneficiaires}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PERSONNES LIÉES */}
        {activeTab === "personnes" && (
          <div className="cf360-tab-content">
            <div className="cf360-tab-toolbar">
              <span className="cf360-tab-count">{related_persons.length} personne{related_persons.length !== 1 ? "s" : ""} liée{related_persons.length !== 1 ? "s" : ""}</span>
              <button className="cf360-add-btn" onClick={() => setShowPersonForm(!showPersonForm)}>
                <Plus size={14} aria-hidden /> Ajouter
              </button>
            </div>

            {showPersonForm && (
              <div className="cf360-inline-form">
                <RelatedPersonForm
                  clientId={clientId}
                  onSuccess={() => { setShowPersonForm(false); router.refresh(); }}
                  onCancel={() => setShowPersonForm(false)}
                />
              </div>
            )}

            {related_persons.length === 0 ? (
              <div className="cf360-empty">
                <Users size={36} aria-hidden />
                <p>Aucune personne liée. Ajoutez le conjoint, les enfants ou les co-parents.</p>
                <button className="cf360-add-btn" onClick={() => setShowPersonForm(true)}>
                  <Plus size={14} aria-hidden /> Ajouter une personne
                </button>
              </div>
            ) : (
              <div className="cf360-persons-grid">
                {related_persons.map((person) => (
                  <div key={person.id} className="cf360-person-card">
                    <div className="cf360-person-card-header">
                      <div
                        className="cf360-person-avatar"
                        style={{ background: RELATION_COLORS[person.type_relation] ?? RELATION_COLORS.autre }}
                      >
                        {person.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="cf360-person-info">
                        <span className="cf360-person-name">{person.full_name}</span>
                        <span className="cf360-person-relation">
                          {RELATION_LABELS[person.type_relation] ?? person.type_relation}
                        </span>
                      </div>
                      <button
                        className="cf360-delete-btn"
                        onClick={() => handleDeletePerson(person.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </div>
                    <div className="cf360-person-details">
                      {person.date_naissance && (
                        <span><Calendar size={11} aria-hidden /> {fmt(person.date_naissance)}</span>
                      )}
                      {person.email && (
                        <a href={`mailto:${person.email}`}><Mail size={11} aria-hidden /> {person.email}</a>
                      )}
                      {person.phone && (
                        <a href={`tel:${person.phone}`}><Phone size={11} aria-hidden /> {person.phone}</a>
                      )}
                    </div>
                    {person.notes && (
                      <p className="cf360-person-notes">{person.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTES */}
        {activeTab === "notes" && (
          <div className="cf360-tab-content">
            <div className="cf360-tab-toolbar">
              <span className="cf360-tab-count">Notes internes</span>
              <Link href={`/admin/clients/${clientId}/modifier`} className="cf360-add-btn">
                <Edit3 size={14} aria-hidden /> Modifier
              </Link>
            </div>
            {client.notes ? (
              <div className="cf360-notes-content">{client.notes as string}</div>
            ) : (
              <div className="cf360-empty">
                <StickyNote size={36} aria-hidden />
                <p>Aucune note interne.</p>
                <Link href={`/admin/clients/${clientId}/modifier`} className="cf360-add-btn">
                  <Edit3 size={14} aria-hidden /> Ajouter une note
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
