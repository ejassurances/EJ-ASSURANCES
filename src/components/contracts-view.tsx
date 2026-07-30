"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  CheckCircle2,
  PenLine,
  Landmark,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { contractStatus } from "@/components/ui/status-maps";

type ClientRef = { id: string; full_name: string | null; email: string | null };

export type ContractRow = {
  id: string;
  contract_number: string | null;
  insurer_name: string | null;
  contract_type: string | null;
  status: string | null;
  effective_date: string | null;
  end_date: string | null;
  prime_annuelle: number | null;
  taux_commission: number | null;
  montant_commission_annuel: number | null;
  created_at: string;
  clients: ClientRef | ClientRef[] | null;
};

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const clientOf = (c: ContractRow): ClientRef | null =>
  Array.isArray(c.clients) ? c.clients[0] ?? null : c.clients;

const FILTERS: { id: string; label: string }[] = [
  { id: "Tous", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "pending_signature", label: "En attente" },
  { id: "draft", label: "Brouillons" },
  { id: "terminated", label: "Résiliés" },
];

export function ContractsView({ contracts }: { contracts: ContractRow[] }) {
  const [filter, setFilter] = useState<string>("Tous");

  const kpis = useMemo(() => {
    const actifs = contracts.filter((c) => c.status === "active");
    const attente = contracts.filter((c) => c.status === "pending_signature");
    const commission = actifs.reduce((s, c) => s + (c.montant_commission_annuel ?? 0), 0);
    return { total: contracts.length, actifs: actifs.length, attente: attente.length, commission };
  }, [contracts]);

  const rows = useMemo(
    () => (filter === "Tous" ? contracts : contracts.filter((c) => c.status === filter)),
    [contracts, filter],
  );

  return (
    <>
      <div className="bo-daybar">
        <div>
          <p className="bo-eyebrow">Portefeuille</p>
          <h2>Les contrats</h2>
          <p>
            {kpis.total} contrat{kpis.total > 1 ? "s" : ""} au portefeuille · {kpis.actifs} actif
            {kpis.actifs > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="bo-kpirow" aria-label="Indicateurs contrats">
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Total contrats</span><span className="bo-kpi-ic"><FileText size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{kpis.total}</div>
          <span className="bo-kpi-sub">au portefeuille</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Contrats actifs</span><span className="bo-kpi-ic"><CheckCircle2 size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{kpis.actifs}</div>
          <span className="bo-kpi-sub">en cours</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">En attente signature</span><span className="bo-kpi-ic"><PenLine size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{kpis.attente}</div>
          <span className="bo-kpi-sub">à finaliser</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Commissions annuelles</span><span className="bo-kpi-ic gold"><Landmark size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{eur(kpis.commission)}</div>
          <span className="bo-kpi-sub">contrats actifs</span>
        </div>
      </div>

      <div className="bo-ec-tabs">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`bo-ec-tab${filter === f.id ? " is-active" : ""}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bo-card">
        {rows.length === 0 ? (
          <div className="bo-card-b">
            <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
              Aucun contrat {filter !== "Tous" ? "dans ce statut" : ""} pour le moment. Les contrats se créent depuis la fiche d&apos;un client.
            </p>
          </div>
        ) : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Contrat</th>
                  <th>Client</th>
                  <th>Assureur</th>
                  <th className="ta-r">Prime / an</th>
                  <th>Statut</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const client = clientOf(c);
                  const st = contractStatus[c.status ?? ""] ?? { tone: "neutral" as const, label: c.status ?? "—" };
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/contrats/${c.id}`} className="bo-table-main">
                          {c.contract_number || "Sans numéro"}
                        </Link>
                        <span className="bo-table-sub">{c.contract_type || "Type non précisé"}</span>
                      </td>
                      <td>
                        <span className="bo-table-main">{client?.full_name || "—"}</span>
                        <span className="bo-table-sub">{client?.email || ""}</span>
                      </td>
                      <td>{c.insurer_name || "—"}</td>
                      <td className="ta-r bo-num">{c.prime_annuelle != null ? eur(c.prime_annuelle) : "—"}</td>
                      <td><StatusBadge tone={st.tone} label={st.label} /></td>
                      <td className="ta-r">
                        <Link href={`/admin/contrats/${c.id}`} className="bo-table-go" aria-label="Ouvrir le contrat">
                          <ChevronRight size={16} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
