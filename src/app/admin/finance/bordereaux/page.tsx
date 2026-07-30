"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Zap,
  Search,
  Filter,
  ChevronRight,
  RefreshCw,
  Eye,
  Download,
  Clock,
  Euro,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { commissionStatus } from "@/components/ui/status-maps";

type MatchStatus = "match" | "impaye" | "taux_erreur" | "resilie" | "inconnu";

type CommissionLine = {
  id: string;
  assureur: string;
  contrat_ref: string;
  client_nom: string;
  type_produit: string;
  prime_annuelle: number;
  taux_attendu: number;
  taux_recu: number;
  montant_attendu: number;
  montant_recu: number;
  ecart: number;
  statut: MatchStatus;
  date_bordereau: string;
};

const DEMO_LINES: CommissionLine[] = [
  { id: "1", assureur: "Generali", contrat_ref: "AE-2024-0312", client_nom: "Martin & Dupont", type_produit: "Assurance emprunteur", prime_annuelle: 1800, taux_attendu: 18, taux_recu: 18, montant_attendu: 324, montant_recu: 324, ecart: 0, statut: "match", date_bordereau: "2026-06-01" },
  { id: "2", assureur: "Allianz", contrat_ref: "PRE-2024-0198", client_nom: "Famille Rousseau", type_produit: "Prévoyance", prime_annuelle: 2400, taux_attendu: 20, taux_recu: 18, montant_attendu: 480, montant_recu: 432, ecart: -48, statut: "taux_erreur", date_bordereau: "2026-06-01" },
  { id: "3", assureur: "CNP Assurances", contrat_ref: "AE-2024-0445", client_nom: "Mme Lefebvre", type_produit: "Assurance emprunteur", prime_annuelle: 2100, taux_attendu: 18, taux_recu: 18, montant_attendu: 378, montant_recu: 378, ecart: 0, statut: "match", date_bordereau: "2026-06-01" },
  { id: "4", assureur: "AXA", contrat_ref: "AE-2023-0089", client_nom: "M. Bernard", type_produit: "Assurance emprunteur", prime_annuelle: 1650, taux_attendu: 18, taux_recu: 0, montant_attendu: 297, montant_recu: 0, ecart: -297, statut: "resilie", date_bordereau: "2026-06-01" },
  { id: "5", assureur: "Generali", contrat_ref: "TRANS-2024-0067", client_nom: "Famille Moreau", type_produit: "Transmission", prime_annuelle: 3200, taux_attendu: 15, taux_recu: 15, montant_attendu: 480, montant_recu: 480, ecart: 0, statut: "match", date_bordereau: "2026-06-01" },
  { id: "6", assureur: "Cardif", contrat_ref: "PRE-2025-0012", client_nom: "M. & Mme Petit", type_produit: "Prévoyance", prime_annuelle: 1920, taux_attendu: 20, taux_recu: 0, montant_attendu: 384, montant_recu: 0, ecart: -384, statut: "impaye", date_bordereau: "2026-06-01" },
  { id: "7", assureur: "CNP Assurances", contrat_ref: "AE-2025-0201", client_nom: "Famille Durand", type_produit: "Assurance emprunteur", prime_annuelle: 2760, taux_attendu: 18, taux_recu: 18, montant_attendu: 496.8, montant_recu: 496.8, ecart: 0, statut: "match", date_bordereau: "2026-06-01" },
  { id: "8", assureur: "Swiss Life", contrat_ref: "INCO-2026-0001", client_nom: "Inconnu", type_produit: "—", prime_annuelle: 0, taux_attendu: 0, taux_recu: 0, montant_attendu: 0, montant_recu: 120, ecart: 120, statut: "inconnu", date_bordereau: "2026-06-01" },
];


const ASSUREURS = ["Tous", "Generali", "Allianz", "CNP Assurances", "AXA", "Cardif", "Swiss Life"];

export default function BordereauxPage() {
  const [lines] = useState<CommissionLine[]>(DEMO_LINES);
  const [filterStatut, setFilterStatut] = useState<string>("Tous");
  const [filterAssureur, setFilterAssureur] = useState<string>("Tous");
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const filtered = lines.filter((l) => {
    const matchStatut = filterStatut === "Tous" || l.statut === filterStatut;
    const matchAssureur = filterAssureur === "Tous" || l.assureur === filterAssureur;
    const matchSearch = !search || l.client_nom.toLowerCase().includes(search.toLowerCase()) || l.contrat_ref.toLowerCase().includes(search.toLowerCase());
    return matchStatut && matchAssureur && matchSearch;
  });

  const totalAttendu = lines.reduce((s, l) => s + l.montant_attendu, 0);
  const totalRecu = lines.reduce((s, l) => s + l.montant_recu, 0);
  const totalEcart = totalAttendu - totalRecu;
  const nbAlertes = lines.filter((l) => l.statut !== "match").length;
  const tauxRapprochement = Math.round((lines.filter((l) => l.statut === "match").length / lines.length) * 100);

  return (
    <div className="finance-module">
      <nav className="page-breadcrumb">
        <Link href="/admin">Accueil</Link><ChevronRight size={12} />
        <Link href="/admin/finance">Finance</Link><ChevronRight size={12} />
        <span>Bordereaux de commissions</span>
      </nav>

      <div className="finance-header">
        <div>
          <p className="eyebrow">Finance & Commissions</p>
          <h1>Bordereaux multi-assureurs</h1>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>Importez vos bordereaux et lancez le matching automatique avec vos contrats enregistrés.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="primary-action" onClick={() => setShowImport(!showImport)}>
            <Upload size={18} aria-hidden /> Importer un bordereau
          </button>
          <button className="secondary-action">
            <RefreshCw size={16} aria-hidden /> Relancer le matching
          </button>
        </div>
      </div>

      {showImport && (
        <div
          className={`import-dropzone${dragOver ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
        >
          <FileSpreadsheet size={40} aria-hidden style={{ color: "var(--accent)" }} />
          <strong>Glissez vos fichiers ici ou cliquez pour sélectionner</strong>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>Formats acceptés : Excel (.xlsx), CSV (.csv), PDF (.pdf) — Taille max : 10 Mo</p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <span className="crm-tag"><FileSpreadsheet size={12} /> Excel / CSV</span>
            <span className="crm-tag">📄 PDF bordereau</span>
            <span className="crm-tag">🤖 Matching IA automatique</span>
          </div>
          <button className="primary-action" style={{ marginTop: "8px" }}>
            <Upload size={16} aria-hidden /> Sélectionner un fichier
          </button>
        </div>
      )}

      <div className="finance-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#10b98115", color: "#10b981" }}><Euro size={22} /></div>
          <div>
            <strong className="finance-kpi-value">{totalRecu.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong>
            <small className="finance-kpi-label">Total reçu</small>
          </div>
        </div>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#3b82f615", color: "#3b82f6" }}><Clock size={22} /></div>
          <div>
            <strong className="finance-kpi-value">{totalAttendu.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong>
            <small className="finance-kpi-label">Total attendu</small>
          </div>
        </div>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#ef444415", color: "#ef4444" }}><AlertTriangle size={22} /></div>
          <div>
            <strong className="finance-kpi-value" style={{ color: totalEcart > 0 ? "#ef4444" : "#10b981" }}>
              {totalEcart > 0 ? "-" : ""}{Math.abs(totalEcart).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </strong>
            <small className="finance-kpi-label">{nbAlertes} alerte{nbAlertes > 1 ? "s" : ""} détectée{nbAlertes > 1 ? "s" : ""}</small>
          </div>
        </div>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#8b5cf615", color: "#8b5cf6" }}><Zap size={22} /></div>
          <div>
            <strong className="finance-kpi-value">{tauxRapprochement}%</strong>
            <small className="finance-kpi-label">Taux de rapprochement</small>
          </div>
        </div>
      </div>

      <div className="crm-filters">
        <div className="crm-search-wrap">
          <Search size={18} className="crm-search-icon" aria-hidden />
          <input className="crm-search" type="search" placeholder="Rechercher par client ou référence contrat…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="crm-filter-chips">
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "13px" }}><Filter size={14} /> Statut :</span>
          {["Tous", "match", "impaye", "taux_erreur", "resilie", "inconnu"].map((s) => (
            <button key={s} className={`crm-chip${filterStatut === s ? " active" : ""}`} onClick={() => setFilterStatut(s)}>
              {s === "Tous" ? "Tous" : commissionStatus[s as MatchStatus]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="crm-filter-chips">
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "13px" }}><Filter size={14} /> Assureur :</span>
          {ASSUREURS.map((a) => (
            <button key={a} className={`crm-chip${filterAssureur === a ? " active" : ""}`} onClick={() => setFilterAssureur(a)}>{a}</button>
          ))}
        </div>
      </div>

      <div className="finance-table-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <strong style={{ fontSize: "15px" }}>{filtered.length} ligne{filtered.length > 1 ? "s" : ""}</strong>
          <button className="secondary-action" style={{ fontSize: "13px", padding: "7px 14px" }}><Download size={15} aria-hidden /> Exporter</button>
        </div>
        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Statut</th><th>Assureur</th><th>Référence contrat</th><th>Client</th><th>Produit</th>
                <th>Taux attendu</th><th>Taux reçu</th><th>Montant attendu</th><th>Montant reçu</th><th>Écart</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((line) => {
                const cfg = commissionStatus[line.statut];
                return (
                  <tr key={line.id} className={`finance-table-row${line.statut !== "match" ? " row-alert" : ""}`}>
                    <td><StatusBadge tone={cfg.tone} label={cfg.label} icon={cfg.icon} /></td>
                    <td><strong>{line.assureur}</strong></td>
                    <td><code style={{ fontSize: "12px", background: "var(--surface-soft)", padding: "2px 6px", borderRadius: "4px" }}>{line.contrat_ref}</code></td>
                    <td>{line.client_nom}</td>
                    <td style={{ fontSize: "13px", color: "var(--muted)" }}>{line.type_produit}</td>
                    <td style={{ textAlign: "right" }}>{line.taux_attendu > 0 ? `${line.taux_attendu}%` : "—"}</td>
                    <td style={{ textAlign: "right", color: line.taux_recu !== line.taux_attendu && line.taux_attendu > 0 ? "#ef4444" : "inherit" }}>{line.taux_recu > 0 ? `${line.taux_recu}%` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{line.montant_attendu > 0 ? `${line.montant_attendu.toFixed(2)} €` : "—"}</td>
                    <td style={{ textAlign: "right", color: "#10b981", fontWeight: 700 }}>{line.montant_recu > 0 ? `${line.montant_recu.toFixed(2)} €` : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: line.ecart < 0 ? "#ef4444" : line.ecart > 0 ? "#f59e0b" : "#10b981" }}>
                      {line.ecart !== 0 ? `${line.ecart > 0 ? "+" : ""}${line.ecart.toFixed(2)} €` : "✓"}
                    </td>
                    <td><button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}><Eye size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
