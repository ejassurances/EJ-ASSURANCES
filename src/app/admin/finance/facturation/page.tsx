"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Euro,
  Send,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { invoiceStatus } from "@/components/ui/status-maps";

type InvoiceStatus = "brouillon" | "envoyee" | "encaissee" | "en_retard";

type Invoice = {
  id: string;
  numero: string;
  client: string;
  prestation: string;
  montant_ht: number;
  tva: number;
  montant_ttc: number;
  statut: InvoiceStatus;
  date_emission: string;
  date_echeance: string;
  date_encaissement?: string;
};

const DEMO_INVOICES: Invoice[] = [
  { id: "1", numero: "FAC-2026-0012", client: "Martin & Dupont", prestation: "Conseil en assurance emprunteur", montant_ht: 400, tva: 0, montant_ttc: 400, statut: "encaissee", date_emission: "2026-05-15", date_echeance: "2026-06-15", date_encaissement: "2026-06-02" },
  { id: "2", numero: "FAC-2026-0013", client: "Famille Rousseau", prestation: "Mission conseil prévoyance famille", montant_ht: 600, tva: 0, montant_ttc: 600, statut: "envoyee", date_emission: "2026-06-01", date_echeance: "2026-07-01" },
  { id: "3", numero: "FAC-2026-0014", client: "Mme Lefebvre", prestation: "Audit couverture emprunteur", montant_ht: 300, tva: 0, montant_ttc: 300, statut: "en_retard", date_emission: "2026-04-10", date_echeance: "2026-05-10" },
  { id: "4", numero: "FAC-2026-0015", client: "Famille Moreau", prestation: "Conseil transmission patrimoniale", montant_ht: 800, tva: 0, montant_ttc: 800, statut: "brouillon", date_emission: "2026-06-18", date_echeance: "2026-07-18" },
  { id: "5", numero: "FAC-2026-0016", client: "M. & Mme Petit", prestation: "Recueil besoins & recommandation", montant_ht: 350, tva: 0, montant_ttc: 350, statut: "encaissee", date_emission: "2026-05-20", date_echeance: "2026-06-20", date_encaissement: "2026-06-10" },
];


export default function FacturationPage() {
  const [filter, setFilter] = useState("Tous");
  const [search, setSearch] = useState("");

  const filtered = DEMO_INVOICES.filter((inv) => {
    const matchFilter = filter === "Tous" || inv.statut === filter;
    const matchSearch = !search || inv.client.toLowerCase().includes(search.toLowerCase()) || inv.numero.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalEncaisse = DEMO_INVOICES.filter((i) => i.statut === "encaissee").reduce((s, i) => s + i.montant_ttc, 0);
  const totalEnAttente = DEMO_INVOICES.filter((i) => i.statut === "envoyee").reduce((s, i) => s + i.montant_ttc, 0);
  const totalEnRetard = DEMO_INVOICES.filter((i) => i.statut === "en_retard").reduce((s, i) => s + i.montant_ttc, 0);

  return (
    <div className="finance-module">
      <nav className="page-breadcrumb">
        <Link href="/admin">Accueil</Link><ChevronRight size={12} />
        <Link href="/admin/finance">Finance</Link><ChevronRight size={12} />
        <span>Facturation honoraires</span>
      </nav>

      <div className="finance-header">
        <div>
          <p className="eyebrow">Finance & Commissions</p>
          <h1>Facturation honoraires</h1>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>Émettez des factures d'honoraires conformes et suivez leurs encaissements.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="primary-action"><Plus size={18} aria-hidden /> Nouvelle facture</button>
          <button className="secondary-action"><Download size={16} aria-hidden /> Exporter</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="finance-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#10b98115", color: "#10b981" }}><CheckCircle2 size={22} /></div>
          <div>
            <strong className="finance-kpi-value">{totalEncaisse.toLocaleString("fr-FR")} €</strong>
            <small className="finance-kpi-label">Encaissé ce mois</small>
          </div>
        </div>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#3b82f615", color: "#3b82f6" }}><Clock size={22} /></div>
          <div>
            <strong className="finance-kpi-value">{totalEnAttente.toLocaleString("fr-FR")} €</strong>
            <small className="finance-kpi-label">En attente d'encaissement</small>
          </div>
        </div>
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon" style={{ background: "#ef444415", color: "#ef4444" }}><XCircle size={22} /></div>
          <div>
            <strong className="finance-kpi-value" style={{ color: "#ef4444" }}>{totalEnRetard.toLocaleString("fr-FR")} €</strong>
            <small className="finance-kpi-label">En retard de paiement</small>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="crm-filters">
        <div className="crm-search-wrap">
          <Search size={18} className="crm-search-icon" aria-hidden />
          <input className="crm-search" type="search" placeholder="Rechercher par client ou numéro de facture…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="crm-filter-chips">
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "13px" }}><Filter size={14} /> Statut :</span>
          {["Tous", "brouillon", "envoyee", "encaissee", "en_retard"].map((s) => (
            <button key={s} className={`crm-chip${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>
              {s === "Tous" ? "Toutes" : invoiceStatus[s as InvoiceStatus]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="finance-table-wrap">
        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Prestation</th>
                <th>Montant HT</th>
                <th>Montant TTC</th>
                <th>Date émission</th>
                <th>Échéance</th>
                <th>Encaissement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const cfg = invoiceStatus[inv.statut];
                return (
                  <tr key={inv.id} className={`finance-table-row${inv.statut === "en_retard" ? " row-alert" : ""}`}>
                    <td><StatusBadge tone={cfg.tone} label={cfg.label} icon={cfg.icon} /></td>
                    <td><code style={{ fontSize: "12px", background: "var(--surface-soft)", padding: "2px 6px", borderRadius: "4px" }}>{inv.numero}</code></td>
                    <td><strong>{inv.client}</strong></td>
                    <td style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "200px" }}>{inv.prestation}</td>
                    <td style={{ textAlign: "right" }}>{inv.montant_ht.toLocaleString("fr-FR")} €</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{inv.montant_ttc.toLocaleString("fr-FR")} €</td>
                    <td style={{ fontSize: "13px" }}>{new Date(inv.date_emission).toLocaleDateString("fr-FR")}</td>
                    <td style={{ fontSize: "13px", color: inv.statut === "en_retard" ? "#ef4444" : "inherit" }}>{new Date(inv.date_echeance).toLocaleDateString("fr-FR")}</td>
                    <td style={{ fontSize: "13px", color: "#10b981" }}>{inv.date_encaissement ? new Date(inv.date_encaissement).toLocaleDateString("fr-FR") : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}><Eye size={16} /></button>
                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}><Download size={16} /></button>
                        {inv.statut === "brouillon" && <button style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }}><Send size={16} /></button>}
                      </div>
                    </td>
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
