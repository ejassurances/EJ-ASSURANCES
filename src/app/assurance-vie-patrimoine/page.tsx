import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, Landmark, PiggyBank, Scale, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Assurance-vie et patrimoine financier - EJ Partners Assurances",
  description:
    "Créer un patrimoine financier grâce à l'assurance-vie, préparer la transmission et protéger les familles atypiques avec une stratégie adaptée.",
};

const blocks = [
  {
    title: "Créer progressivement un capital",
    text: "Mettre en place une épargne régulière, compréhensible, adaptée à l'horizon de placement et à la situation familiale.",
    icon: PiggyBank,
  },
  {
    title: "Préparer la transmission",
    text: "Travailler les clauses bénéficiaires, la liquidité successorale et la cohérence avec les héritiers légaux.",
    icon: FileCheck2,
  },
  {
    title: "Protéger les proches choisis",
    text: "Identifier les personnes qui comptent réellement, y compris dans les familles recomposées, LGBT+ ou en coparentalité.",
    icon: ShieldCheck,
  },
];

export default function AssuranceViePatrimoinePage() {
  return (
    <>
      <SiteHeader />
      <main className="public-main">
        <section className="compact-hero">
          <p className="eyebrow">Assurance-vie & patrimoine</p>
          <h1>Créer un patrimoine financier qui protège les bonnes personnes.</h1>
          <p className="hero-copy">
            L'assurance-vie peut devenir un outil puissant pour épargner, transmettre et sécuriser
            les proches. Encore faut-il que la clause, les objectifs et les bénéficiaires reflètent
            vraiment votre famille.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/devis/assurance-vie">Faire mon recueil assurance vie <ArrowRight size={16} aria-hidden /></Link>
            <Link className="secondary-action" href="/contact#rendez-vous">Prendre rendez-vous</Link>
          </div>
        </section>

        <section className="ej-products-band">
          {blocks.map((block) => {
            const Icon = block.icon;
            return (
              <article key={block.title} className="ej-product-card">
                <Icon size={22} aria-hidden />
                <h3>{block.title}</h3>
                <p>{block.text}</p>
              </article>
            );
          })}
        </section>

        <section className="ej-method-section">
          <div>
            <p className="eyebrow">Points de vigilance</p>
            <h2>Une assurance-vie mal paramétrée peut protéger les mauvaises personnes.</h2>
            <p>
              Nous analysons la clause bénéficiaire, le régime familial, les enfants, le conjoint,
              le parent social, les objectifs de transmission et les risques de contestation.
            </p>
          </div>
          <ol className="ej-method-list">
            <li><span>01</span> Définir l'objectif : épargne, transmission, liquidité, protection.</li>
            <li><span>02</span> Vérifier les bénéficiaires et les écarts avec la famille réelle.</li>
            <li><span>03</span> Documenter le conseil, les risques et les choix retenus.</li>
          </ol>
        </section>

        <section className="ej-products-band">
          <article className="ej-product-card">
            <Scale size={22} aria-hidden />
            <h3>Famille juridique</h3>
            <p>Qui hérite selon les règles par défaut ? Qui est protégé par le droit aujourd'hui ?</p>
          </article>
          <article className="ej-product-card">
            <Landmark size={22} aria-hidden />
            <h3>Patrimoine financier</h3>
            <p>Quels supports, quels versements, quel horizon et quelle cohérence avec les revenus ?</p>
          </article>
          <article className="ej-product-card">
            <FileCheck2 size={22} aria-hidden />
            <h3>Clause bénéficiaire</h3>
            <p>La clause doit être compréhensible, datée, cohérente et alignée avec votre volonté.</p>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
