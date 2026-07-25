"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  TrendingUp,
  Zap,
  Bot,
  Scale,
  DollarSign,
  BarChart3,
  Settings,
  Bell,
  Search,
  Building2,
  Bike,
  ClipboardCheck,
  UserPlus,
  Menu,
  X,
} from "lucide-react";
import { CurrentUser } from "@/lib/auth";
import { Role } from "@/lib/content";

type AppShellProps = {
  role: Role;
  user: CurrentUser;
  children?: ReactNode;
};

// P0-01 — Stabilisation du socle.
// `hidden: true` masque un lien de la navigation sans le supprimer : la cible
// correspond à un module non encore développé (specs 201→226 / backlog 229).
// Réactiver = passer `hidden` à false une fois la page livrée. Ne pas supprimer.
type NavLink = { label: string; href: string; icon: LucideIcon; hidden?: boolean };
type AdminModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  description: string;
  links: NavLink[];
};

const adminModules: AdminModule[] = [
  {
    id: "crm",
    label: "CRM & Productivité",
    icon: Users,
    href: "/admin/crm",
    description: "Clients, contacts, agenda, tâches",
    links: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
      { label: "Clients", href: "/admin/clients", icon: Users },
      { label: "Contrats", href: "/admin/contrats", icon: FileText },
      { label: "Partenaires", href: "/admin/partenaires", icon: Building2 },
      // Masqués — modules non développés (Agenda 213, Activités/Tâches 202, Contacts).
      { label: "Contacts & Prospects", href: "/admin/crm/contacts", icon: Users, hidden: true },
      { label: "Agenda & RDV", href: "/admin/crm/agenda", icon: LayoutDashboard, hidden: true },
      { label: "Tâches", href: "/admin/crm/taches", icon: FileText, hidden: true },
    ],
  },
  {
    id: "vente",
    label: "Vente, Leads & GED",
    icon: TrendingUp,
    href: "/admin/vente",
    description: "Pipeline, devis, documents",
    links: [
      { label: "Import Drive vers CRM", href: "/admin/vente/ged/import-drive", icon: FolderOpen },
      { label: "Synchronisation Drive", href: "/admin/vente/ged/sync", icon: FolderOpen },
      { label: "GED — Documents", href: "/admin/vente/ged", icon: FolderOpen },
      { label: "Assurance emprunteur", href: "/admin/emprunteur", icon: FileText },
      { label: "Méthode cabinet", href: "/admin/family-protection-os", icon: ShieldCheck },
      // Masqués — modules non développés (Opportunités/pipeline 209, Leads, Devis 205).
      { label: "Pipeline commercial", href: "/admin/vente/pipeline", icon: TrendingUp, hidden: true },
      { label: "Leads entrants", href: "/admin/vente/leads", icon: TrendingUp, hidden: true },
      { label: "Devis & Propositions", href: "/admin/vente/devis", icon: FileText, hidden: true },
    ],
  },
  {
    id: "workflows",
    label: "Workflows",
    icon: Zap,
    href: "/admin/workflows",
    description: "Automatisations, processus, statuts",
    links: [
      { label: "Mes workflows", href: "/admin/workflows", icon: Zap },
      { label: "Assurance trottinette", href: "/admin/workflows/trottinette", icon: Bike },
      // Masqués — modules non développés (Workflows configurables 211, Templates 215, Notifications 199).
      { label: "Automatisations", href: "/admin/workflows/automatisations", icon: Zap, hidden: true },
      { label: "Statuts de projet", href: "/admin/workflows/statuts", icon: FileText, hidden: true },
      { label: "Modèles de documents", href: "/admin/workflows/templates", icon: FileText, hidden: true },
      { label: "Notifications", href: "/admin/workflows/notifications", icon: Bell, hidden: true },
    ],
  },
  {
    id: "ia",
    label: "Pilotage IA",
    icon: Bot,
    href: "/admin/ia",
    description: "Analyse IA, recommandations, scoring",
    links: [
      { label: "Tableau IA", href: "/admin/ia", icon: Bot },
      { label: "Copilot IA", href: "/admin/ia/copilot", icon: Bot },
      { label: "Résumé client IA", href: "/admin/ia/resume-client", icon: FileText },
      { label: "Rédaction IA", href: "/admin/ia/redaction", icon: FileText },
      { label: "Cross-selling IA", href: "/admin/ia/cross-selling", icon: TrendingUp },
      { label: "Anonymisation", href: "/admin/ia/anonymisation", icon: ShieldCheck },
      { label: "Recueil des besoins", href: "/admin/family-protection-os/recueil", icon: FileText },
      // Masqués — modules non développés (Analyse familiale, Scoring, Recommandations IA).
      { label: "Analyse familiale IA", href: "/admin/ia/analyse-familiale", icon: Bot, hidden: true },
      { label: "Scoring clients", href: "/admin/ia/scoring", icon: BarChart3, hidden: true },
      { label: "Recommandations", href: "/admin/ia/recommandations", icon: Bot, hidden: true },
    ],
  },
  {
    id: "conformite",
    label: "Conformité",
    icon: Scale,
    href: "/admin/conformite",
    description: "ORIAS, DDA, RGPD, classeurs ACPR",
    links: [
      { label: "Tableau conformité", href: "/admin/conformite", icon: Scale },
      { label: "LCB-FT", href: "/admin/conformite/lcb-ft", icon: ShieldCheck },
      { label: "Lettres de mission", href: "/admin/lettres-mission", icon: FileText },
      // Masqués — modules non développés (Classeurs ACPR, DDA, RGPD, Journal d'audit 226).
      { label: "Classeurs ACPR", href: "/admin/conformite/acpr", icon: FolderOpen, hidden: true },
      { label: "DDA & Devoir conseil", href: "/admin/conformite/dda", icon: FileText, hidden: true },
      { label: "RGPD", href: "/admin/conformite/rgpd", icon: ShieldCheck, hidden: true },
      { label: "Journal d'audit", href: "/admin/conformite/audit", icon: FileText, hidden: true },
    ],
  },
  {
    id: "finance",
    label: "Finance & Coms",
    icon: DollarSign,
    href: "/admin/finance",
    description: "Commissions, mandataires, facturation",
    links: [
      { label: "Tableau finance", href: "/admin/finance", icon: DollarSign },
      { label: "Encaissements", href: "/admin/finance/encaissements", icon: DollarSign },
      { label: "Reversements", href: "/admin/finance/reversements", icon: DollarSign },
      { label: "Avenants", href: "/admin/finance/avenants", icon: FileText },
      { label: "Bordereaux", href: "/admin/finance/bordereaux", icon: FileText },
      { label: "Facturation", href: "/admin/finance/facturation", icon: FileText },
      { label: "Exports", href: "/admin/finance/exports", icon: FolderOpen },
      // Masqués — modules non développés (Commissions dédiées, gestion Mandataires/Prescripteurs).
      { label: "Commissions", href: "/admin/finance/commissions", icon: DollarSign, hidden: true },
      { label: "Mandataires", href: "/admin/mandataire", icon: Users, hidden: true },
      { label: "Prescripteurs", href: "/admin/prescripteur", icon: Users, hidden: true },
    ],
  },
  {
    id: "stats",
    label: "Stats & Analyses",
    icon: BarChart3,
    href: "/admin/stats",
    description: "KPIs, rapports, performance",
    links: [
      { label: "Vue d'ensemble", href: "/admin/stats", icon: BarChart3 },
      { label: "Commercial", href: "/admin/stats/commercial", icon: TrendingUp },
      { label: "Portefeuille", href: "/admin/stats/portefeuille", icon: BarChart3 },
      { label: "Production", href: "/admin/stats/production", icon: BarChart3 },
      // Masqués — modules non développés (Reporting 220, KPI 219, Exports stats 221).
      { label: "Performance cabinet", href: "/admin/stats/performance", icon: TrendingUp, hidden: true },
      { label: "Rapports clients", href: "/admin/stats/clients", icon: Users, hidden: true },
      { label: "Rapports financiers", href: "/admin/stats/finance", icon: DollarSign, hidden: true },
      { label: "Exports", href: "/admin/stats/exports", icon: FolderOpen, hidden: true },
    ],
  },
];

const clientModules: NavLink[] = [
  { label: "Tableau de bord", href: "/client", icon: LayoutDashboard },
  { label: "Diagnostic familial", href: "/client/diagnostic-familial", icon: ShieldCheck },
  { label: "Mes projets", href: "/client#projets", icon: FolderOpen },
  { label: "Mes contrats", href: "/client#contrats", icon: FileText },
  { label: "Mes documents", href: "/client#documents", icon: FolderOpen },
  { label: "Classeur ACPR", href: "/client#classeur-acpr", icon: Scale },
  { label: "Messages", href: "/client#messages", icon: Bell },
];

// Navigation dédiée mandataire (les liens de section pointent vers le dashboard).
const mandataireModules: NavLink[] = [
  { label: "Tableau de bord", href: "/mandataire", icon: LayoutDashboard },
  { label: "Recueil des besoins", href: "/mandataire/recueil-besoins", icon: ClipboardCheck },
  { label: "Mes clients", href: "/mandataire#mandataire-clients", icon: Users },
  { label: "Conformité", href: "/mandataire#conformite", icon: ShieldCheck },
];

// Navigation dédiée prescripteur : pas de classeur ACPR, mais un KYC.
const prescripteurModules: NavLink[] = [
  { label: "Tableau de bord", href: "/prescripteur", icon: LayoutDashboard },
  { label: "Déposer un prospect", href: "/prescripteur#depot", icon: UserPlus },
  { label: "Suivi prospects", href: "/prescripteur#prospects", icon: FolderOpen },
  { label: "KYC", href: "/prescripteur#kyc", icon: ShieldCheck },
  { label: "Convention", href: "/prescripteur#convention", icon: FileText },
];

const nonAdminNavByRole: Record<string, NavLink[]> = {
  client: clientModules,
  mandataire: mandataireModules,
  prescripteur: prescripteurModules,
};

export function AppShell({ role, user, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = role === "admin" || role === "courtier";
  const nonAdminNav = nonAdminNavByRole[role] ?? clientModules;
  const spaceLabel = isAdmin
    ? "Espace cabinet"
    : role === "mandataire"
      ? "Espace mandataire"
      : role === "prescripteur"
        ? "Espace prescripteur"
        : "Espace client";
  const settingsHref =
    role === "mandataire"
      ? "/mandataire#parametres"
      : role === "prescripteur"
        ? "/prescripteur#parametres"
        : "/client#parametres";
  const isLinkActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  const closeMenu = () => setMenuOpen(false);
  const nameParts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
  const firstName = nameParts[0] ?? user.fullName;
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0]?.toUpperCase() : "";
  const shortName = lastInitial ? `${firstName} ${lastInitial}.` : firstName;

  return (
    <div className={`app-layout${menuOpen ? " bo-nav-open" : ""}`}>
      {/* Fond cliquable du tiroir mobile */}
      <button className="bo-backdrop" type="button" aria-label="Fermer le menu" tabIndex={menuOpen ? 0 : -1} onClick={closeMenu} />
      <aside className="sidebar">
        {/* Brand */}
        <Link className="brand app-brand" href="/" onClick={closeMenu}>
          <Image
            className="brand-logo"
            src="/logo-ej-partners-assurances.png"
            alt="EJ Partners Assurances"
            width={852}
            height={253}
            priority
          />
          <span className="app-brand-title">
            <small>{spaceLabel}</small>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="side-nav" aria-label={isAdmin ? "Navigation cabinet" : "Navigation client"}>
          {isAdmin ? (
            <>
              {adminModules.map((module, idx) => {
                const Icon = module.icon;
                const visibleLinks = module.links.filter((l) => !l.hidden);
                const isActive = visibleLinks.some((l) => isLinkActive(l.href));
                return (
                  <div key={module.id} className="side-nav-group">
                    {idx > 0 && <div className="side-nav-divider" />}
                    <Link href={module.href} className={`side-nav-group-label${isActive ? " module-active" : ""}`} onClick={closeMenu}>
                      <Icon size={12} aria-hidden />
                      {module.label}
                    </Link>
                    {visibleLinks.map((link) => {
                      const LinkIcon = link.icon;
                      const linkActive = isLinkActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={linkActive ? "active" : ""}
                          onClick={closeMenu}
                        >
                          <LinkIcon size={15} aria-hidden />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ) : (
            nonAdminNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={closeMenu}>
                  <Icon size={15} aria-hidden />
                  {item.label}
                </Link>
              );
            })
          )}

          {/* Paramètres — masqué côté cabinet tant que le Moteur de Paramétrage (spec 224)
              n'est pas livré (/admin/parametres n'existe pas). Réactiver à ce moment-là. */}
          {!isAdmin && (
            <>
              <div className="side-nav-divider" />
              <Link href={settingsHref} onClick={closeMenu}>
                <Settings size={15} aria-hidden />
                Paramètres
              </Link>
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="sidebar-footer bo-side-foot">
          <div className="bo-side-user">
            <ShieldCheck size={14} aria-hidden />
            <span>{user.email}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="bo-signout" type="submit">
              <LogOut size={14} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="workspace">
        <header className="workspace-header bo-topbar">
          <div className="bo-topbar-left">
            <button
              className="bo-burger"
              type="button"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>
            <div className="bo-greeting">
              <p className="eyebrow">{isAdmin ? "Cabinet EJ Partners Assurances" : "Espace client"}</p>
              <h1>Bonjour, {user.fullName.split(" ")[0]} 👋</h1>
            </div>
          </div>
          <div className="bo-topbar-right">
            <div className="bo-search">
              <Search size={16} aria-hidden />
              <input type="search" placeholder="Rechercher un client, un projet, un contrat…" aria-label="Recherche globale" />
              <span className="bo-kbd" aria-hidden>⌘K</span>
            </div>
            <button className="bo-iconbtn" title="Notifications" aria-label="Notifications">
              <Bell size={17} aria-hidden />
              <span className="bo-dot" aria-hidden />
            </button>
            <div className="bo-userchip" title={user.fullName}>
              <span className="bo-userchip-av">{initials}</span>
              <span className="bo-userchip-id">
                <span className="bo-userchip-name">{shortName}</span>
                <span className="bo-role">{user.role}</span>
              </span>
            </div>
          </div>
        </header>

        <div className="bo-page">{children}</div>
      </main>
    </div>
  );
}
