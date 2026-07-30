import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getClientsList } from "@/lib/actions/clients";
import {
  Users, UserPlus, Search, Phone, Mail, FileText,
  ChevronRight, TrendingUp, Filter, Star
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { clientStatus } from "@/components/ui/status-maps";

export const metadata: Metadata = { title: "Clients 360° — CRM EJ Partners" };

const FAMILY_ICONS: Record<string, string> = {
  "coparentalité": "👨‍👩‍👧",
  "famille recomposée": "👨‍👩‍👧‍👦",
  "famille homoparentale": "🏳️‍🌈",
  "lgbt": "🏳️‍🌈",
  "monoparentale": "👤",
};

function getFamilyIcon(context?: string | null): string {
  if (!context) return "👤";
  const lower = context.toLowerCase();
  for (const [key, icon] of Object.entries(FAMILY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "👤";
}

function getAvatarGradient(name: string): string {
  // Palette sobre DES-001 : dégradés marine → teal, une touche or (rare).
  const gradients = [
    "linear-gradient(140deg, #132E47, #1F7A80)",
    "linear-gradient(140deg, #1D3E5C, #2AA0A6)",
    "linear-gradient(140deg, #0E2439, #186468)",
    "linear-gradient(140deg, #243746, #1F7A80)",
    "linear-gradient(140deg, #17323F, #4A6B7C)",
    "linear-gradient(140deg, #1A3A4A, #BE9E56)",
  ];
  const idx = (name.charCodeAt(0) || 65) % gradients.length;
  return gradients[idx];
}

const CONTACT_TYPE_TABS = [
  { value: "", label: "Tous", icon: "👥" },
  { value: "prospect", label: "Prospects", icon: "🎯" },
  { value: "client", label: "Clients", icon: "⭐" },
  { value: "partenaire", label: "Partenaires", icon: "🤝" },
  { value: "prescripteur", label: "Prescripteurs", icon: "📣" },
];

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; statut?: string; type?: string }>;
}) {
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) redirect("/connexion");

  const params = await searchParams;
  const clients = await getClientsList({
    search: params.search,
    statut: params.statut,
    contact_type: params.type || undefined,
  });

  const stats = {
    total: clients.length,
    clients: clients.filter((c) => (c as { contact_type?: string }).contact_type === "client").length,
    prospects: clients.filter((c) => (c as { contact_type?: string }).contact_type === "prospect").length,
    partenaires: clients.filter((c) => (c as { contact_type?: string }).contact_type === "partenaire").length,
    prescripteurs: clients.filter((c) => (c as { contact_type?: string }).contact_type === "prescripteur").length,
  };

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      {/* En-tête */}
      <div className="bo-pagehead">
        <div>
          <p className="bo-eyebrow">CRM · Fiches clients</p>
          <h1>Clients 360°</h1>
          <p>Tout l&apos;historique de vos assurés et prospects, centralisé.</p>
        </div>
        <Link href="/admin/clients/nouveau" className="bo-btn bo-btn-primary">
          <UserPlus size={16} aria-hidden /> Nouveau client
        </Link>
      </div>

      {/* KPI */}
      <div className="bo-kpirow">
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Total clients</span><span className="bo-kpi-ic"><Users size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{stats.total}</div>
          <span className="bo-kpi-sub">fiches accessibles</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Clients</span><span className="bo-kpi-ic"><Star size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{stats.clients}</div>
          <span className="bo-kpi-sub">clients actifs</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Prospects</span><span className="bo-kpi-ic"><TrendingUp size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{stats.prospects}</div>
          <span className="bo-kpi-sub">à convertir</span>
        </div>
        <div className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Partenaires & prescripteurs</span><span className="bo-kpi-ic gold"><FileText size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{stats.partenaires + stats.prescripteurs}</div>
          <span className="bo-kpi-sub">contacts réseau</span>
        </div>
      </div>

      {/* Onglets par type de contact */}
      <div className="bo-tabs">
        {CONTACT_TYPE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/clients${tab.value ? `?type=${tab.value}` : ""}`}
            className={`bo-tab ${(params.type ?? "") === tab.value ? "on" : ""}`}
          >
            <span aria-hidden>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>

      {/* Recherche & filtres (form GET inchangé) */}
      <form method="GET" className="bo-searchbar">
        <div className="bo-searchfield">
          <Search size={16} aria-hidden />
          <input
            type="text"
            name="search"
            placeholder="Rechercher un client par nom, email ou téléphone…"
            defaultValue={params.search ?? ""}
          />
        </div>
        <div className="bo-selectwrap">
          <Filter size={14} aria-hidden />
          <select name="statut" defaultValue={params.statut ?? ""}>
            <option value="">Tous les statuts</option>
            <option value="prospect">Prospect</option>
            <option value="en_cours">En cours</option>
            <option value="actif">Client actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>
        {params.type && <input type="hidden" name="type" value={params.type} />}
        <button type="submit" className="bo-btn bo-btn-primary">Rechercher</button>
        {(params.search || params.statut) && (
          <Link href={`/admin/clients${params.type ? `?type=${params.type}` : ""}`} className="bo-reset">✕ Réinitialiser</Link>
        )}
      </form>

      {/* Liste */}
      {clients.length === 0 ? (
        <div className="bo-empty">
          <div className="bo-empty-ic"><Users size={30} aria-hidden /></div>
          <h3>Aucun client trouvé</h3>
          <p>
            {params.search || params.statut
              ? "Aucun résultat pour ces critères. Modifiez votre recherche."
              : "Votre CRM est vide. Créez votre première fiche client pour commencer."}
          </p>
          <Link href="/admin/clients/nouveau" className="bo-btn bo-btn-primary">
            <UserPlus size={16} aria-hidden /> Créer un client
          </Link>
        </div>
      ) : (
        <div className="bo-tilegrid">
          {clients.map((client) => {
            const statut_client = (client as { statut_client?: string }).statut_client ?? "prospect";
            const contact_type = (client as { contact_type?: string }).contact_type ?? "prospect";
            const statusCfg = clientStatus[statut_client] ?? clientStatus.prospect;
            const contactTypeLabel: Record<string, string> = {
              prospect: "🎯 Prospect", client: "⭐ Client",
              partenaire: "🤝 Partenaire", prescripteur: "📣 Prescripteur",
            };
            const tags: { tag: string }[] = (client as { client_tags?: { tag: string }[] }).client_tags ?? [];
            const contracts: { id: string; status: string }[] =
              (client as { contracts?: { id: string; status: string }[] }).contracts ?? [];
            const activeCount = contracts.filter((c) => c.status === "active").length;
            const name = client.full_name ?? "Client sans nom";
            const familyIcon = getFamilyIcon(client.family_context as string | undefined);

            return (
              <Link key={client.id} href={`/admin/clients/${client.id}`} className="bo-tile">
                <div className="bo-tile-top">
                  <div className="bo-tile-av" style={{ background: getAvatarGradient(name) }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="bo-tile-badges">
                    <span className="bo-tile-type">{contactTypeLabel[contact_type] ?? contact_type}</span>
                    <StatusBadge tone={statusCfg.tone} label={statusCfg.label} />
                  </div>
                </div>

                <div>
                  <h3 className="bo-tile-name">{name}</h3>
                  {client.family_context && (
                    <p className="bo-tile-context">
                      <span aria-hidden>{familyIcon}</span>
                      {client.family_context as string}
                    </p>
                  )}
                </div>

                <div className="bo-tile-contact">
                  {client.email && (
                    <span><Mail size={13} aria-hidden />{client.email as string}</span>
                  )}
                  {client.phone && (
                    <span><Phone size={13} aria-hidden />{client.phone as string}</span>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="bo-tags">
                    {tags.slice(0, 2).map((t) => (
                      <span key={t.tag} className="bo-tag">{t.tag}</span>
                    ))}
                    {tags.length > 2 && (
                      <span className="bo-tag bo-tag-more">+{tags.length - 2}</span>
                    )}
                  </div>
                )}

                <div className="bo-tile-foot">
                  <span className="bo-tile-contracts">
                    <FileText size={13} aria-hidden />
                    {activeCount} contrat{activeCount !== 1 ? "s" : ""}
                  </span>
                  <span className="bo-tile-go">Voir la fiche <ChevronRight size={14} aria-hidden /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
