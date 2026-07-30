import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RecueilTunnel, type RecueilConfig } from "@/components/recueil-tunnel";

export const metadata: Metadata = {
  title: "Recueil des besoins — Assurance vie & patrimoine — EJ Partners Assurances",
  description: "Préparez votre étude assurance vie : objectif, horizon et profil. Le cabinet vous recontacte.",
  robots: { index: false, follow: false },
};

const config: RecueilConfig = {
  product: "assurance_vie",
  productLabel: "Assurance vie & patrimoine",
  title: "Assurance vie",
  subtitle: "Préparons votre projet patrimonial",
  questions: [
    {
      name: "objectif", label: "Objectif principal", type: "select", required: true,
      options: [
        { value: "epargne", label: "Me constituer une épargne" },
        { value: "transmission", label: "Préparer une transmission" },
        { value: "retraite", label: "Compléter ma retraite" },
        { value: "revenu", label: "Générer un complément de revenu" },
      ],
    },
    {
      name: "horizon", label: "Horizon de placement", type: "select", required: true,
      options: [
        { value: "court", label: "Court terme (< 4 ans)" },
        { value: "moyen", label: "Moyen terme (4 à 8 ans)" },
        { value: "long", label: "Long terme (> 8 ans)" },
      ],
    },
    {
      name: "montant", label: "Montant à placer (€)", type: "select", required: true,
      options: [
        { value: "<10k", label: "Moins de 10 000 €" },
        { value: "10-50k", label: "10 000 à 50 000 €" },
        { value: "50-150k", label: "50 000 à 150 000 €" },
        { value: ">150k", label: "Plus de 150 000 €" },
      ],
    },
    {
      name: "profil", label: "Profil de risque", type: "select", required: true,
      options: [
        { value: "prudent", label: "Prudent" },
        { value: "equilibre", label: "Équilibré" },
        { value: "dynamique", label: "Dynamique" },
      ],
    },
    { name: "precisions", label: "Précisions (optionnel)", type: "textarea", placeholder: "Contexte, projets, questions…" },
  ],
};

export default function RecueilAssuranceViePage() {
  return (
    <>
      <SiteHeader />
      <main className="public-main">
        <RecueilTunnel config={config} />
      </main>
    </>
  );
}
