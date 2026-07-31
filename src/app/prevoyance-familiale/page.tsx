import { PublicPage } from "@/components/public-page";
import { expertisePages } from "@/lib/content";

export default function PrevoyanceFamilialePage() {
  return (
    <PublicPage
      {...expertisePages["/prevoyance-familiale"]}
      recueilHref="/devis/prevoyance"
      recueilLabel="Faire mon recueil prévoyance"
    />
  );
}
