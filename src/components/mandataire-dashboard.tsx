import Link from "next/link";
import {
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  Landmark,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { ClientDirectory } from "@/components/client-directory";
import { ClientRecord } from "@/lib/client-records";
import { CurrentUser } from "@/lib/auth";

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

const mandataireModules = [
  {
    icon: ClipboardCheck,
    title: "Recueil des besoins",
    description: "Situation familiale, projet, documents et validation cabinet.",
    href: "/mandataire/recueil-besoins",
    stat: "Demandes",
  },
  {
    icon: UsersRound,
    title: "Mes clients",
    description: "Clients rattachés, dossiers actifs, pièces attendues et historique.",
    href: "#mandataire-clients",
    stat: "Portefeuille",
  },
  {
    icon: ShieldCheck,
    title: "Mon profil conformité",
    description: "Convention, ORIAS, formations et documents réglementaires.",
    href: "/mandataire#conformite",
    stat: "ORIAS",
  },
];

export function MandataireDashboard({
  clients,
  user,
}: {
  clients: ClientRecord[];
  user: CurrentUser;
}) {
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const nbClients = clients.length;

  return (
    <>
      {/* Barre du jour */}
      <div className="bo-daybar">
        <div>
          <p className="bo-eyebrow">Espace mandataire</p>
          <h2>Bonjour {firstName}</h2>
          <p>
            {nbClients} client{nbClients > 1 ? "s" : ""} au portefeuille
            {" · "}
            Recueil des besoins et suivi des dossiers rattachés
          </p>
        </div>
        <div className="bo-daybar-actions">
          <Link href="/mandataire/recueil-besoins" className="bo-btn bo-btn-primary">
            <ClipboardCheck size={16} aria-hidden /> Nouveau recueil des besoins
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="bo-kpirow" aria-label="Indicateurs mandataire">
        <a href="#mandataire-clients" className="bo-kpi">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">Clients suivis</span>
            <span className="bo-kpi-ic"><UsersRound size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val bo-num">{nbClients}</div>
          <span className="bo-kpi-sub">rattachés à votre mandat</span>
        </a>
        <div className="bo-kpi is-soon">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">Projets ouverts</span>
            <span className="bo-kpi-ic"><FolderOpen size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val">—</div>
          <span className="bo-kpi-sub">bientôt disponible</span>
        </div>
        <div className="bo-kpi is-soon">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">Commissions à valider</span>
            <span className="bo-kpi-ic"><Landmark size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val">—</div>
          <span className="bo-kpi-sub">bientôt disponible</span>
        </div>
      </div>

      {/* Derniers clients + actions rapides */}
      <div className="bo-grid2">
        <div className="bo-stack">
          <div className="bo-card">
            <div className="bo-card-h">
              <h2>Derniers clients</h2>
              <a href="#mandataire-clients" className="bo-seemore">
                Voir tous <ChevronRight size={14} aria-hidden />
              </a>
            </div>
            {nbClients === 0 ? (
              <div className="bo-card-b">
                <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
                  Aucun client rattaché pour le moment. Lancez un recueil des besoins
                  pour créer un premier dossier.
                </p>
              </div>
            ) : (
              <div className="bo-list">
                {clients.slice(0, 5).map((client) => (
                  <Link key={client.id} href={`/mandataire/clients/${client.id}`}>
                    <span className="bo-avatar">{initialsOf(client.full_name ?? "?")}</span>
                    <span className="bo-txt">
                      <span className="nm">{client.full_name || "Client sans nom"}</span>
                      <span className="sub">{client.email || "Email non renseigné"}</span>
                    </span>
                    <ChevronRight className="chev" size={16} aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bo-stack">
          <div className="bo-card">
            <div className="bo-card-h"><h3>Actions rapides</h3></div>
            <div className="bo-card-b">
              <div className="bo-quick">
                <Link href="/mandataire/recueil-besoins">
                  <ClipboardCheck size={17} aria-hidden /> Nouveau recueil des besoins
                  <ChevronRight className="chev" size={15} aria-hidden />
                </Link>
                <a href="#mandataire-clients">
                  <UsersRound size={17} aria-hidden /> Consulter mes clients
                  <ChevronRight className="chev" size={15} aria-hidden />
                </a>
                <Link href="/mandataire#conformite">
                  <ShieldCheck size={17} aria-hidden /> Mon profil conformité
                  <ChevronRight className="chev" size={15} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="bo-sec">
        <div className="bo-sec-h">
          <div>
            <p className="bo-eyebrow">Espace de travail</p>
            <h2>Vos outils mandataire</h2>
          </div>
        </div>
        <div className="bo-modgrid">
          {mandataireModules.map((card) => {
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

      {/* Annuaire clients complet */}
      <div id="mandataire-clients" className="bo-sec">
        <div className="bo-sec-h">
          <div>
            <p className="bo-eyebrow">Portefeuille</p>
            <h2>Mes clients</h2>
          </div>
          <Link href="/mandataire/recueil-besoins" className="bo-btn bo-btn-onnavy">
            <UserPlus size={16} aria-hidden /> Nouveau dossier
          </Link>
        </div>
        <ClientDirectory clients={clients} basePath="/mandataire/clients" />
      </div>
    </>
  );
}
