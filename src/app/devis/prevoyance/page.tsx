import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RecueilTunnel, type RecueilConfig } from "@/components/recueil-tunnel";

export const metadata: Metadata = {
  title: "Recueil des besoins — Prévoyance individuelle — EJ Partners Assurances",
  description: "Préparez votre étude prévoyance : statut, objectifs de couverture et personnes à charge. Le cabinet vous recontacte.",
  robots: { index: false, follow: false },
};

const config: RecueilConfig = {
  product: "prevoyance_individuelle",
  productLabel: "Prévoyance individuelle",
  title: "Prévoyance individuelle",
  subtitle: "Protégeons vos revenus et vos proches",
  questions: [
    {
      name: "statut", label: "Statut professionnel", type: "select", required: true,
      options: [
        { value: "salarie", label: "Salarié" },
        { value: "tns", label: "Travailleur non salarié (TNS)" },
        { value: "fonctionnaire", label: "Fonctionnaire" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      name: "objectif", label: "Ce que vous voulez couvrir", type: "select", required: true,
      options: [
        { value: "arret_travail", label: "Maintien de revenu (arrêt de travail)" },
        { value: "invalidite", label: "Invalidité" },
        { value: "deces", label: "Décès (protection des proches)" },
        { value: "global", label: "Couverture globale" },
      ],
    },
    {
      name: "revenu", label: "Revenu annuel à protéger (€)", type: "select", required: true,
      options: [
        { value: "<30k", label: "Moins de 30 000 €" },
        { value: "30-60k", label: "30 000 à 60 000 €" },
        { value: "60-100k", label: "60 000 à 100 000 €" },
        { value: ">100k", label: "Plus de 100 000 €" },
      ],
    },
    {
      name: "charge", label: "Personnes à charge", type: "select", required: true,
      options: [
        { value: "0", label: "Aucune" },
        { value: "1-2", label: "1 à 2" },
        { value: "3+", label: "3 ou plus" },
      ],
    },
    { name: "precisions", label: "Précisions (optionnel)", type: "textarea", placeholder: "Situation, contrats existants, questions…" },
  ],
};

export default function RecueilPrevoyancePage() {
  return (
    <>
      <SiteHeader />
      <main className="public-main">
        <RecueilTunnel config={config} />
      </main>
    </>
  );
}
