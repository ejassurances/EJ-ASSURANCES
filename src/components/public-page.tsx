import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type PublicPageProps = {
  title: string;
  eyebrow: string;
  description: string;
  highlights: string[];
  examples?: { title: string; text: string }[];
  checks?: string[];
  outcome?: string;
  /** Si fourni, ajoute un CTA « recueil des besoins » en action principale du hero. */
  recueilHref?: string;
  recueilLabel?: string;
  children?: React.ReactNode;
};

export function PublicPage({ title, eyebrow, description, highlights, examples = [], checks = [], outcome, recueilHref, recueilLabel, children }: PublicPageProps) {
  return (
    <>
      <SiteHeader />
      <main className="public-main">
        <section className="page-hero compact-hero">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="hero-copy">{description}</p>
            <div className="hero-actions">
              {recueilHref ? (
                <>
                  <Link className="primary-action" href={recueilHref}>
                    {recueilLabel ?? "Faire mon recueil en ligne"} <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link className="secondary-action" href="/contact#rendez-vous">
                    Prendre rendez-vous
                  </Link>
                </>
              ) : (
                <>
                  <Link className="primary-action" href="/contact#rendez-vous">
                    Prendre rendez-vous <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link className="secondary-action" href="/connexion">
                    Accéder à mon espace
                  </Link>
                </>
              )}
            </div>
          </div>
          <aside className="trust-panel" aria-label="Points d'accompagnement">
            {highlights.map((item) => (
              <div key={item} className="trust-row">
                <CheckCircle2 size={20} aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </aside>
        </section>

        <section className="content-band">
          <div>
            <h2>Une approche familiale avant assurantielle</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
              Avant de parler contrat, nous clarifions les personnes à protéger, les liens qui
              existent vraiment dans votre foyer, les droits déjà acquis et les zones de fragilité.
              C'est cette lecture qui permet ensuite de choisir des garanties utiles.
            </p>
          </div>
          <div>
            <h2>Un cadre confidentiel et bienveillant</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
              Les sujets abordés sont parfois intimes : couple, filiation, succession, argent,
              santé ou séparation. Le cabinet vous accueille sans jugement et documente les choix
              pour que chaque décision reste claire.
            </p>
          </div>
        </section>

        {examples.length > 0 && (
          <section className="example-section">
            <div className="section-heading">
              <p className="eyebrow">Exemples concrets</p>
              <h2>Des situations que le cabinet rencontre souvent</h2>
            </div>
            <div className="example-grid">
              {examples.map((example) => (
                <article className="example-card" key={example.title}>
                  <h3>{example.title}</h3>
                  <p>{example.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {(checks.length > 0 || outcome) && (
          <section className="content-band detail-band">
            {checks.length > 0 && (
              <div>
                <p className="eyebrow">Ce que nous vérifions</p>
                <h2>Une analyse utile avant de choisir une solution</h2>
                <ul className="service-list">
                  {checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
            )}
            {outcome && (
              <div>
                <p className="eyebrow">Résultat attendu</p>
                <h2>Une protection plus lisible</h2>
                <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>{outcome}</p>
                <Link className="primary-action standalone" href={recueilHref ?? "/contact#rendez-vous"}>
                  {recueilHref ? (recueilLabel ?? "Faire mon recueil en ligne") : "Demander une première analyse"} <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            )}
          </section>
        )}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
