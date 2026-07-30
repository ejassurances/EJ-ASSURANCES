import Link from "next/link";
import { ArrowLeft, ChevronRight, Mail, Phone, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { contractStatus } from "@/components/ui/status-maps";

type ClientRef = { id: string; full_name: string | null; email: string | null; phone?: string | null };

export type ContractDetailData = {
  id: string;
  client_id: string | null;
  contract_number: string | null;
  insurer_name: string | null;
  contract_type: string | null;
  status: string | null;
  effective_date: string | null;
  end_date: string | null;
  prime_annuelle: number | null;
  prime_mensuelle: number | null;
  taux_commission: number | null;
  montant_commission_annuel: number | null;
  economies_realisees: number | null;
  beneficiaires: string | null;
  notes: string | null;
  created_at: string;
  clients: ClientRef | ClientRef[] | null;
};

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const dateFr = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bo-kv">
      <span className="bo-kv-l">{label}</span>
      <span className="bo-kv-v">{value}</span>
    </div>
  );
}

export function ContractDetail({ contract }: { contract: ContractDetailData }) {
  const client = Array.isArray(contract.clients) ? contract.clients[0] ?? null : contract.clients;
  const st = contractStatus[contract.status ?? ""] ?? { tone: "neutral" as const, label: contract.status ?? "—" };

  return (
    <>
      <div className="bo-fichehead">
        <div>
          <Link href="/admin/contrats" className="bo-back">
            <ArrowLeft size={15} aria-hidden /> Retour aux contrats
          </Link>
          <h1>{contract.contract_number || "Contrat sans numéro"}</h1>
          <p className="bo-fichehead-sub">
            {contract.contract_type || "Type non précisé"}
            {contract.insurer_name ? ` · ${contract.insurer_name}` : ""}
          </p>
        </div>
        <StatusBadge tone={st.tone} label={st.label} />
      </div>

      <div className="bo-grid2">
        <div className="bo-stack">
          <div className="bo-card">
            <div className="bo-card-h"><h2>Caractéristiques du contrat</h2></div>
            <div className="bo-card-b">
              <div className="bo-kvgrid">
                <KV label="Assureur" value={contract.insurer_name || "—"} />
                <KV label="Type de contrat" value={contract.contract_type || "—"} />
                <KV label="N° de contrat" value={contract.contract_number || "—"} />
                <KV label="Statut" value={<StatusBadge tone={st.tone} label={st.label} />} />
                <KV label="Date d'effet" value={dateFr(contract.effective_date)} />
                <KV label="Échéance" value={dateFr(contract.end_date)} />
              </div>
            </div>
          </div>

          <div className="bo-card">
            <div className="bo-card-h"><h2>Primes & rémunération</h2></div>
            <div className="bo-card-b">
              <div className="bo-kvgrid">
                <KV label="Prime annuelle" value={contract.prime_annuelle != null ? eur(contract.prime_annuelle) : "—"} />
                <KV label="Prime mensuelle" value={contract.prime_mensuelle != null ? eur(contract.prime_mensuelle) : "—"} />
                <KV label="Taux de commission" value={contract.taux_commission != null ? `${contract.taux_commission} %` : "—"} />
                <KV label="Commission annuelle" value={contract.montant_commission_annuel != null ? eur(contract.montant_commission_annuel) : "—"} />
                {contract.economies_realisees != null && contract.economies_realisees > 0 && (
                  <KV label="Économies réalisées" value={eur(contract.economies_realisees)} />
                )}
              </div>
            </div>
          </div>

          {(contract.beneficiaires || contract.notes) && (
            <div className="bo-card">
              <div className="bo-card-h"><h2>Détails</h2></div>
              <div className="bo-card-b" style={{ display: "grid", gap: "14px" }}>
                {contract.beneficiaires && (
                  <div>
                    <p className="bo-kv-l" style={{ marginBottom: "4px" }}>Bénéficiaires</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "var(--bo-ink)" }}>{contract.beneficiaires}</p>
                  </div>
                )}
                {contract.notes && (
                  <div>
                    <p className="bo-kv-l" style={{ marginBottom: "4px" }}>Notes</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "var(--bo-ink)", whiteSpace: "pre-wrap" }}>{contract.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bo-stack">
          <div className="bo-card">
            <div className="bo-card-h"><h3>Client</h3></div>
            <div className="bo-card-b">
              {client ? (
                <>
                  <div className="bo-ec-row" style={{ padding: "0 0 12px", borderBottom: "1px solid var(--bo-border)" }}>
                    <div>
                      <p className="bo-ec-lab" style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <UserRound size={15} aria-hidden /> {client.full_name || "Client sans nom"}
                      </p>
                    </div>
                  </div>
                  {client.email && (
                    <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--muted)", margin: "12px 0 0" }}>
                      <Mail size={14} aria-hidden /> {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--muted)", margin: "8px 0 0" }}>
                      <Phone size={14} aria-hidden /> {client.phone}
                    </p>
                  )}
                  {contract.client_id && (
                    <Link href={`/admin/clients/${contract.client_id}`} className="bo-btn bo-btn-primary" style={{ marginTop: "16px", width: "100%", justifyContent: "center" }}>
                      Ouvrir la fiche client <ChevronRight size={15} aria-hidden />
                    </Link>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>Aucun client rattaché.</p>
              )}
            </div>
          </div>

          <div className="bo-card">
            <div className="bo-card-h"><h3>Suivi</h3></div>
            <div className="bo-card-b">
              <div className="bo-kvgrid">
                <KV label="Créé le" value={dateFr(contract.created_at)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
