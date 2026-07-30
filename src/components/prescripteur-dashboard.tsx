import {
  BadgeCheck,
  ChevronRight,
  FolderOpen,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProspectDepositForm } from "@/components/prospect-deposit-form";
import { CurrentUser } from "@/lib/auth";

const prescripteurModules = [
  {
    icon: UserPlus,
    title: "Déposer un prospect",
    description: "Transmettez les coordonnées d'un contact, le cabinet se charge de la qualification.",
    href: "#depot",
    stat: "Apport",
  },
  {
    icon: FolderOpen,
    title: "Suivi des prospects",
    description: "État d'avancement des contacts transmis : qualifiés, en cours, transformés.",
    href: "#prospects",
    stat: "Pipeline",
  },
  {
    icon: ShieldCheck,
    title: "KYC & convention",
    description: "Vérification d'identité et convention d'apport d'affaires.",
    href: "#kyc",
    stat: "Conformité",
  },
];

export function PrescripteurDashboard({ user }: { user: CurrentUser }) {
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;

  return (
    <>
      {/* Barre du jour */}
      <div className="bo-daybar">
        <div>
          <p className="bo-eyebrow">Espace prescripteur</p>
          <h2>Bonjour {firstName}</h2>
          <p>Transmettez vos prospects et suivez leur transformation en toute transparence.</p>
        </div>
        <div className="bo-daybar-actions">
          <a href="#depot" className="bo-btn bo-btn-primary">
            <UserPlus size={16} aria-hidden /> Déposer un prospect
          </a>
        </div>
      </div>

      {/* Dépôt — formulaire fonctionnel */}
      <ProspectDepositForm />

      {/* KPI — empty-state honnête tant que la source prospects n'est pas branchée */}
      <div className="bo-kpirow" aria-label="Indicateurs prescripteur">
        <div className="bo-kpi is-soon">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">Prospects transmis</span>
            <span className="bo-kpi-ic"><UserPlus size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val">—</div>
          <span className="bo-kpi-sub">bientôt disponible</span>
        </div>
        <div className="bo-kpi is-soon">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">En cours de qualification</span>
            <span className="bo-kpi-ic"><FolderOpen size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val">—</div>
          <span className="bo-kpi-sub">bientôt disponible</span>
        </div>
        <div className="bo-kpi is-soon">
          <div className="bo-kpi-top">
            <span className="bo-kpi-lab">Transformés en contrat</span>
            <span className="bo-kpi-ic"><BadgeCheck size={16} aria-hidden /></span>
          </div>
          <div className="bo-kpi-val">—</div>
          <span className="bo-kpi-sub">bientôt disponible</span>
        </div>
      </div>

      {/* Suivi prospects */}
      <div id="prospects" className="bo-sec">
        <div className="bo-card">
          <div className="bo-card-h"><h2>Suivi des prospects</h2></div>
          <div className="bo-card-b">
            <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
              Aucun prospect transmis pour le moment. Utilisez « Déposer un prospect »
              pour transmettre votre premier contact — vous suivrez ensuite ici sa
              qualification et sa transformation.
            </p>
          </div>
        </div>
      </div>

      {/* Conformité : KYC + convention (pas de classeur ACPR côté prescripteur) */}
      <div className="bo-sec">
        <div className="bo-sec-h">
          <div>
            <p className="bo-eyebrow">Conformité</p>
            <h2>Votre habilitation</h2>
          </div>
        </div>
        <div className="bo-grid2">
          <div id="kyc" className="bo-card">
            <div className="bo-card-h">
              <h3>Vérification d'identité (KYC)</h3>
              <StatusBadge tone="warning" label="À compléter" />
            </div>
            <div className="bo-card-b">
              <p style={{ color: "var(--muted)", fontSize: "13.5px", margin: 0 }}>
                La vérification KYC (pièce d'identité) est requise pour valider votre
                habilitation d'apporteur. Votre conseiller EJ Partners vous transmettra
                la démarche à suivre.
              </p>
            </div>
          </div>
          <div id="convention" className="bo-card">
            <div className="bo-card-h">
              <h3>Convention d'apport</h3>
              <StatusBadge tone="neutral" label="En attente" />
            </div>
            <div className="bo-card-b">
              <p style={{ color: "var(--muted)", fontSize: "13.5px", margin: 0 }}>
                Votre convention d'apporteur d'affaires signée apparaîtra ici, avec les
                conditions de rémunération applicables.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="bo-sec">
        <div className="bo-sec-h">
          <div>
            <p className="bo-eyebrow">Espace de travail</p>
            <h2>Vos outils prescripteur</h2>
          </div>
        </div>
        <div className="bo-modgrid">
          {prescripteurModules.map((card) => {
            const Icon = card.icon;
            return (
              <a key={card.href} href={card.href} className="bo-modcard">
                <span className="bo-modcard-ic"><Icon size={19} aria-hidden /></span>
                <p className="bo-eyebrow">{card.stat}</p>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="go">Accéder <ChevronRight size={14} aria-hidden /></span>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
