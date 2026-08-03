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
  BriefcaseBusiness,
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

// Menu CRM allégé : une entrée par domaine (les sous-fonctions vivent dans
// la page de chaque domaine, plus dans la barre latérale).
const adminNav: NavLink[] = [
  { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "Contrats", href: "/admin/contrats", icon: FileText },
  { label: "Projets", href: "/admin/workflows", icon: Zap },
  { label: "Assurance emprunteur", href: "/admin/emprunteur", icon: BriefcaseBusiness },
  { label: "Partenaires", href: "/admin/partenaires", icon: Building2 },
  { label: "Conformité", href: "/admin/conformite", icon: Scale },
  { label: "Finance", href: "/admin/finance", icon: DollarSign },
  { label: "Pilotage IA", href: "/admin/ia", icon: Bot },
  { label: "Statistiques", href: "/admin/stats", icon: BarChart3 },
];

// Onglets contextuels d'un domaine : affichés en haut de la page quand on est
// dans le domaine (garde la barre latérale minimale sans orpheliner les sous-pages).
const adminSubnav: { match: string[]; links: NavLink[] }[] = [
  {
    match: ["/admin/workflows", "/admin/family-protection-os", "/admin/vente"],
    links: [
      { label: "Mes workflows", href: "/admin/workflows", icon: Zap },
      { label: "Assurance trottinette", href: "/admin/workflows/trottinette", icon: Bike },
      { label: "Recueil des besoins", href: "/admin/family-protection-os/recueil", icon: ClipboardCheck },
      { label: "Méthode cabinet", href: "/admin/family-protection-os", icon: ShieldCheck },
      { label: "GED — Documents", href: "/admin/vente/ged", icon: FolderOpen },
    ],
  },
  {
    match: ["/admin/conformite", "/admin/lettres-mission"],
    links: [
      { label: "Tableau", href: "/admin/conformite", icon: Scale },
      { label: "LCB-FT", href: "/admin/conformite/lcb-ft", icon: ShieldCheck },
      { label: "Lettres de mission", href: "/admin/lettres-mission", icon: FileText },
    ],
  },
  {
    match: ["/admin/finance"],
    links: [
      { label: "Tableau", href: "/admin/finance", icon: DollarSign },
      { label: "Encaissements", href: "/admin/finance/encaissements", icon: DollarSign },
      { label: "Reversements", href: "/admin/finance/reversements", icon: DollarSign },
      { label: "Avenants", href: "/admin/finance/avenants", icon: FileText },
      { label: "Bordereaux", href: "/admin/finance/bordereaux", icon: FileText },
      { label: "Facturation", href: "/admin/finance/facturation", icon: FileText },
      { label: "Exports", href: "/admin/finance/exports", icon: FolderOpen },
    ],
  },
  {
    match: ["/admin/ia"],
    links: [
      { label: "Tableau IA", href: "/admin/ia", icon: Bot },
      { label: "Copilot", href: "/admin/ia/copilot", icon: Bot },
      { label: "Résumé client", href: "/admin/ia/resume-client", icon: FileText },
      { label: "Rédaction", href: "/admin/ia/redaction", icon: FileText },
      { label: "Cross-selling", href: "/admin/ia/cross-selling", icon: TrendingUp },
      { label: "Anonymisation", href: "/admin/ia/anonymisation", icon: ShieldCheck },
    ],
  },
  {
    match: ["/admin/stats"],
    links: [
      { label: "Vue d'ensemble", href: "/admin/stats", icon: BarChart3 },
      { label: "Commercial", href: "/admin/stats/commercial", icon: TrendingUp },
      { label: "Portefeuille", href: "/admin/stats/portefeuille", icon: BarChart3 },
      { label: "Production", href: "/admin/stats/production", icon: BarChart3 },
    ],
  },
];

export function AppShell({ role, user, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = role === "admin" || role === "courtier";
  const nonAdminNav = nonAdminNavByRole[role] ?? clientModules;
  const activeSubnav = isAdmin
    ? adminSubnav.find((s) => s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)))
    : undefined;
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
            adminNav.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={closeMenu}>
                  <Icon size={15} aria-hidden />
                  {item.label}
                </Link>
              );
            })
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

        {activeSubnav && (
          <nav className="bo-subnav" aria-label="Sous-navigation du domaine">
            {activeSubnav.links.map((l) => {
              const LinkIcon = l.icon;
              const active = isLinkActive(l.href);
              return (
                <Link key={l.href} href={l.href} className={`bo-subnav-tab${active ? " is-active" : ""}`} onClick={closeMenu}>
                  <LinkIcon size={14} aria-hidden /> {l.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="bo-page">{children}</div>
      </main>
    </div>
  );
}
