import Link from "next/link";
import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Scale,
  TrendingUp,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getAccessibleClients } from "@/lib/clients";
import { getEmprunteurStats } from "@/lib/actions/emprunteur";

// Flag de réactivation — panneaux « À connecter » du Dashboard.
// La structure est conservée ci-dessous mais masquée tant que le lot fonctionnel
// « Données Dashboard » (backlog) n'est pas livré. Repasser à `true` pour réafficher.
const SHOW_DASHBOARD_PLACEHOLDERS = false;

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const adminModuleCards = [
  {
    icon: Users,
    title: "Clients & fiches 360",
    description: "Fiches clients, familles, contrats, interactions et projets rattachés.",
    href: "/admin/clients",
    stat: "Portefeuille",
  },
  {
    icon: BriefcaseBusiness,
    title: "Assurance emprunteur",
    description: "Prospects, recueil des besoins, pièces, workflow de souscription et activation.",
    href: "/admin/emprunteur",
    stat: "Dossiers entrants",
  },
  {
    icon: Workflow,
    title: "Workflows cabinet",
    description: "Étapes, automatisations, statuts, relances et modèles opérationnels.",
    href: "/admin/workflows",
    stat: "Process",
  },
  {
    icon: Scale,
    title: "Conformité",
    description: "DDA, LCB-FT, RGPD, classeurs ACPR, audit et obligations courtage.",
    href: "/admin/conformite",
    stat: "ACPR",
  },
  {
    icon: Bot,
    title: "Assistants IA",
    description: "Résumé client, rédaction, anonymisation, copilot et recommandations.",
    href: "/admin/ia",
    stat: "Copilot",
  },
  {
    icon: BarChart3,
    title: "Pilotage",
    description: "Production, portefeuille, statistiques commerciales et indicateurs cabinet.",
    href: "/admin/stats",
    stat: "KPIs",
  },
];

export default async function AdminDashboardPage() {
  const user = await requireRole(["admin", "courtier"]);
  const [clients, emprunteurStats] = await Promise.all([
    getAccessibleClients(user),
    getEmprunteurStats(),
  ]);

  const activeClients = clients.length;
  const pendingBorrowerFiles = emprunteurStats.non_convertis;

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      {/* Vue de la journée */}
      <div className="bo-daybar">
        <div>
          <p className="bo-eyebrow">Votre journée</p>
          <h2>Priorités du cabinet</h2>
          <p>
            {pendingBorrowerFiles} dossier{pendingBorrowerFiles > 1 ? "s" : ""} emprunteur à traiter
            {" · "}
            {emprunteurStats.cette_semaine} nouveau{emprunteurStats.cette_semaine > 1 ? "x" : ""} cette semaine
            {" · "}
            {activeClients} client{activeClients > 1 ? "s" : ""} au portefeuille
          </p>
        </div>
        <div className="bo-daybar-actions">
          <Link href="/admin/clients/nouveau" className="bo-btn bo-btn-primary">
            <UserPlus size={16} aria-hidden /> Créer une fiche client
          </Link>
          <Link href="/admin/emprunteur" className="bo-btn bo-btn-onnavy">
            <BriefcaseBusiness size={16} aria-hidden /> Traiter les dossiers
          </Link>
        </div>
      </div>

      {/* KPI actionnables */}
      <div className="bo-kpirow" aria-label="Indicateurs cabinet">
        <Link href="/admin/clients" className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Portefeuille clients</span><span className="bo-kpi-ic"><Users size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{activeClients}</div>
          <span className="bo-kpi-sub">fiches accessibles</span>
        </Link>
        <Link href="/admin/emprunteur" className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Dossiers emprunteur</span><span className="bo-kpi-ic"><ClipboardList size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{emprunteurStats.total}</div>
          <span className="bo-kpi-sub">reçus au total</span>
        </Link>
        <Link href="/admin/emprunteur" className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Convertis CRM</span><span className="bo-kpi-ic"><CheckCircle2 size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{emprunteurStats.convertis}</div>
          <span className="bo-kpi-sub">fiches rattachées</span>
        </Link>
        <Link href="/admin/emprunteur" className="bo-kpi">
          <div className="bo-kpi-top"><span className="bo-kpi-lab">Nouveaux cette semaine</span><span className="bo-kpi-ic gold"><TrendingUp size={16} aria-hidden /></span></div>
          <div className="bo-kpi-val bo-num">{emprunteurStats.cette_semaine}</div>
          <span className="bo-kpi-delta"><TrendingUp size={13} aria-hidden /> flux entrant</span>
        </Link>
      </div>

      {/* À traiter + à venir */}
      <div className="bo-grid2">
        <div className="bo-stack">
          <div className="bo-card">
            <div className="bo-card-h">
              <h2>À traiter en priorité</h2>
              <Link href="/admin/emprunteur" className="bo-seemore">Ouvrir la file <ChevronRight size={14} aria-hidden /></Link>
            </div>
            <div className="bo-urgent">
              <div className="bo-urgent-badge"><BriefcaseBusiness size={22} aria-hidden /></div>
              <div className="bo-txt">
                <span className="n bo-num">{pendingBorrowerFiles}</span>
                <span className="t">dossier{pendingBorrowerFiles > 1 ? "s" : ""} emprunteur à convertir ou relancer</span>
              </div>
              <Link href="/admin/emprunteur" className="bo-btn bo-btn-primary">Ouvrir <ChevronRight size={15} aria-hidden /></Link>
            </div>
          </div>

          {clients.length > 0 && (
            <div className="bo-card">
              <div className="bo-card-h">
                <h2>Derniers clients</h2>
                <Link href="/admin/clients" className="bo-seemore">Voir tous <ChevronRight size={14} aria-hidden /></Link>
              </div>
              <div className="bo-list">
                {clients.slice(0, 5).map((client) => (
                  <Link key={client.id} href={`/admin/clients/${client.id}`}>
                    <span className="bo-avatar">{initialsOf(client.full_name ?? "?")}</span>
                    <span className="bo-txt">
                      <span className="nm">{client.full_name}</span>
                      <span className="sub">{client.email || "Email non renseigné"}</span>
                    </span>
                    <ChevronRight className="chev" size={16} aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bo-stack">
          {/* Structure conservée, masquée derrière un flag jusqu'au lot « Données Dashboard ». */}
          {SHOW_DASHBOARD_PLACEHOLDERS && (
            <div className="bo-card">
              <div className="bo-card-h"><h3>À venir sur votre tableau de bord</h3></div>
              <div className="bo-card-b">
                <div className="bo-soon">
                  <span className="bo-soon-ic"><Clock size={17} aria-hidden /></span>
                  <span className="bo-txt"><span className="nm">Tâches & relances</span><span className="sub">agenda et relances clients</span></span>
                  <span className="tag">À connecter</span>
                </div>
                <div className="bo-soon">
                  <span className="bo-soon-ic"><FolderOpen size={17} aria-hidden /></span>
                  <span className="bo-txt"><span className="nm">Projets à traiter</span><span className="sub">pipeline des projets clients</span></span>
                  <span className="tag">À connecter</span>
                </div>
                <div className="bo-soon">
                  <span className="bo-soon-ic"><FileText size={17} aria-hidden /></span>
                  <span className="bo-txt"><span className="nm">Contrats à échéance</span><span className="sub">renouvellements et échéances</span></span>
                  <span className="tag">À connecter</span>
                </div>
                <div className="bo-soon">
                  <span className="bo-soon-ic"><Bell size={17} aria-hidden /></span>
                  <span className="bo-txt"><span className="nm">Notifications importantes</span><span className="sub">alertes conformité et signatures</span></span>
                  <span className="tag">À connecter</span>
                </div>
              </div>
            </div>
          )}

          <div className="bo-card">
            <div className="bo-card-h"><h3>Actions rapides</h3></div>
            <div className="bo-card-b">
              <div className="bo-quick">
                <Link href="/admin/clients/nouveau"><UserPlus size={17} aria-hidden /> Nouvelle fiche client <ChevronRight className="chev" size={15} aria-hidden /></Link>
                <Link href="/admin/family-protection-os/recueil"><FileText size={17} aria-hidden /> Recueil des besoins <ChevronRight className="chev" size={15} aria-hidden /></Link>
                <Link href="/admin/conformite/lcb-ft"><Scale size={17} aria-hidden /> Contrôle LCB-FT <ChevronRight className="chev" size={15} aria-hidden /></Link>
                <Link href="/admin/vente/ged"><FolderOpen size={17} aria-hidden /> Centre documentaire <ChevronRight className="chev" size={15} aria-hidden /></Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules cabinet */}
      <div className="bo-sec">
        <div className="bo-sec-h">
          <div><p className="bo-eyebrow">Modules cabinet</p><h2>Votre espace de travail</h2></div>
        </div>
        <div className="bo-modgrid">
          {adminModuleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="bo-modcard">
                <span className="bo-modcard-ic"><Icon size={19} aria-hidden /></span>
                <p className="bo-eyebrow">{card.stat}</p>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="go">Accéder <ChevronRight size={14} aria-hidden /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
