import { PublicPage } from "@/components/public-page";
import { expertisePages } from "@/lib/content";
import { SimulateurClient } from "@/components/borrower-savings-simulator";

export default function AssuranceEmprunteurPage() {
  return (
    <PublicPage
      {...expertisePages["/assurance-emprunteur"]}
      recueilHref="/devis/emprunteur"
      recueilLabel="Faire mon devis en ligne"
    >
      <section id="simulateur" className="bg-[#F6F9FC] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow">Simulateur d'economie</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#0F172A] sm:text-5xl">
              Estimez vos economies sur l'assurance emprunteur.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#475569]">
              Renseignez votre pret, vos emprunteurs et votre contrat actuel pour obtenir une premiere estimation.
              Le resultat reste indicatif : le cabinet verifie ensuite les garanties, quotites et equivalences bancaires.
            </p>
          </div>
          <SimulateurClient />
        </div>
      </section>
    </PublicPage>
  );
}
