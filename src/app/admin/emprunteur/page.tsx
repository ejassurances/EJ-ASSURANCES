import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getEmprunteurDossiers, getEmprunteurStats } from "@/lib/actions/emprunteur";
import { ConvertDossierButton } from "./convert-button";
import { Home, Mail, Phone, FileText, ChevronRight, CheckCircle2, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Prospects Emprunteur — CRM EJ Partners" };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:               { label: "Démarré",           color: "#92400e", bg: "#fef3c7" },
  documents_uploaded:  { label: "Docs envoyés",      color: "#1e40af", bg: "#dbeafe" },
  completed:           { label: "Complet",            color: "#065f46", bg: "#d1fae5" },
};

export default async function AdminEmprunteurPage() {
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) redirect("/connexion");
  const authedUser = user!;

  const [dossiers, stats] = await Promise.all([
    getEmprunteurDossiers(),
    getEmprunteurStats(),
  ]);

  const nonConvertis = dossiers.filter((d) => !d.client_id);
  const convertis = dossiers.filter((d) => !!d.client_id);

  return (
    <AppShell role={authedUser.role === "courtier" ? "courtier" : "admin"} user={authedUser}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <Link href="/admin" className="back-link">
            ← Tableau de bord
          </Link>
          <h1>Prospects Assurance Emprunteur</h1>
          <p className="admin-page-subtitle">
            Dossiers issus du tunnel public — convertissez-les en fiches clients CRM
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="emprunteur-stats-grid">
        <div className="emprunteur-stat-card">
          <span className="emprunteur-stat-label">Total dossiers</span>
          <strong className="emprunteur-stat-value">{stats.total}</strong>
        </div>
        <div className="emprunteur-stat-card emprunteur-stat-alert">
          <span className="emprunteur-stat-label">À traiter</span>
          <strong className="emprunteur-stat-value">{stats.non_convertis}</strong>
        </div>
        <div className="emprunteur-stat-card">
          <span className="emprunteur-stat-label">Convertis</span>
          <strong className="emprunteur-stat-value">{stats.convertis}</strong>
        </div>
        <div className="emprunteur-stat-card">
          <span className="emprunteur-stat-label">Cette semaine</span>
          <strong className="emprunteur-stat-value">{stats.cette_semaine}</strong>
        </div>
      </div>

      {/* Dossiers à convertir */}
      {nonConvertis.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <div className="emprunteur-section-header">
            <Clock size={18} aria-hidden />
            <h2>À traiter ({nonConvertis.length})</h2>
          </div>
          <div className="emprunteur-list">
            {nonConvertis.map((d) => {
              const sc = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.draft;
              return (
                <div key={d.id} className="emprunteur-card">
                  <div className="emprunteur-card-avatar">
                    {d.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="emprunteur-card-body">
                    <div className="emprunteur-card-top">
                      <strong className="emprunteur-card-name">{d.full_name}</strong>
                      <span className="emprunteur-status-badge" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="emprunteur-card-meta">
                      {d.email && <span><Mail size={13} aria-hidden /> {d.email}</span>}
                      {d.phone && <span><Phone size={13} aria-hidden /> {d.phone}</span>}
                      {d.credits_count ? <span><Home size={13} aria-hidden /> {d.credits_count} crédit{d.credits_count > 1 ? "s" : ""}</span> : null}
                      <span><FileText size={13} aria-hidden /> {formatDate(d.created_at)}</span>
                    </div>
                  </div>
                  <ConvertDossierButton dossierId={d.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dossiers convertis */}
      {convertis.length > 0 && (
        <section>
          <div className="emprunteur-section-header">
            <CheckCircle2 size={18} aria-hidden style={{ color: "#10b981" }} />
            <h2 style={{ color: "#065f46" }}>Convertis ({convertis.length})</h2>
          </div>
          <div className="emprunteur-list">
            {convertis.map((d) => (
              <div key={d.id} className="emprunteur-card emprunteur-card--converted">
                <div className="emprunteur-card-avatar emprunteur-card-avatar--converted">
                  {d.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="emprunteur-card-body">
                  <div className="emprunteur-card-top">
                    <strong className="emprunteur-card-name">{d.full_name}</strong>
                    <span className="emprunteur-status-badge" style={{ background: "#d1fae5", color: "#065f46" }}>
                      ✓ Client CRM
                    </span>
                  </div>
                  <div className="emprunteur-card-meta">
                    {d.email && <span><Mail size={13} aria-hidden /> {d.email}</span>}
                    {d.converted_at && <span>Converti le {formatDate(d.converted_at)}</span>}
                  </div>
                </div>
                {d.client_id && (
                  <Link href={`/admin/clients/${d.client_id}`} className="emprunteur-view-btn">
                    Voir fiche <ChevronRight size={14} aria-hidden />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {dossiers.length === 0 && (
        <div className="emprunteur-empty">
          <p>Aucun dossier emprunteur reçu pour l&apos;instant.</p>
          <p style={{ fontSize: "14px", color: "var(--muted)", marginTop: "8px" }}>
            Les prospects remplissant le formulaire public apparaîtront ici automatiquement.
          </p>
        </div>
      )}
    </AppShell>
  );
}
