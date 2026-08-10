import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createContactIntakeAction } from "@/app/actions/contact-intake";

/* Page contact : formulaire courtier assurance emprunteur en glass-card Navy Fintech. */
export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez EJ Partners Assurances pour une analyse assurance emprunteur ou transmission parent social enfant.",
};

type ContactPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { success, error } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F6F9FC] px-4 py-16 text-[#0F172A] sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="pt-4">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3B82F6]">Contact</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-[#0F172A] sm:text-6xl">
            Parlons de votre <span className="text-gradient">protection familiale</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#475569]">
            Expliquez-nous votre prêt, votre situation familiale ou votre enjeu de transmission.
            Le cabinet vous recontacte pour identifier les risques et les prochaines étapes.
          </p>
          <div className="mt-8 grid gap-3 text-[#475569]">
            <a href="tel:+33189314029" className="flex items-center gap-3 transition hover:text-[#0F172A]">
              <Phone size={18} aria-hidden /> 01.89.31.40.29
            </a>
            <a href="mailto:contact@ej-assurances.fr" className="flex items-center gap-3 transition hover:text-[#0F172A]">
              <Mail size={18} aria-hidden /> contact@ej-assurances.fr
            </a>
          </div>
        </div>

        <form action={createContactIntakeAction} className="glass-card grid gap-5 p-6 sm:p-8">
          <div>
            <h2 className="text-2xl font-black text-[#0F172A]">Demande d'étude personnalisée</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Remplissez ce formulaire pour qu'un conseiller analyse vos besoins.
            </p>
          </div>

          {success && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700">
              Votre demande est enregistrée. Un conseiller revient vers vous rapidement.
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
              Impossible d'enregistrer la demande pour le moment. Vous pouvez aussi nous contacter par téléphone.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Prénom *
              <input name="firstName" required className="navy-input" placeholder="Jean" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Nom *
              <input name="name" required className="navy-input" placeholder="Dupont" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              E-mail *
              <input name="email" type="email" required className="navy-input" placeholder="jean.dupont@email.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Téléphone *
              <input name="phone" type="tel" required className="navy-input" placeholder="06 12 34 56 78" />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-[#475569]">
            Type d'assurance recherchée *
            <select name="typeAssurance" required defaultValue="" className="navy-input">
              <option value="" disabled>
                -- Sélectionnez une option --
              </option>
              <option value="Mutuelle Santé">Mutuelle / Complémentaire Santé</option>
              <option value="Prévoyance">Prévoyance &amp; Protection Sociale</option>
              <option value="Assurance Auto / Flotte">Assurance Auto / Flotte</option>
              <option value="Assurance Habitation / Immeuble">Assurance Habitation / Immeuble</option>
              <option value="RC Professionnelle / Multirisque">RC Professionnelle / Multirisque Pro</option>
              <option value="Autre">Autre demande</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#475569]">
            Précisions sur vos besoins
            <textarea
              name="message"
              rows={4}
              className="navy-input min-h-36 resize-y"
              placeholder="Décrivez succinctement votre situation actuelle, votre budget ou vos attentes..."
            />
          </label>

          {/* Champ piège anti-bot : invisible pour les humains, ignoré côté serveur. */}
          <div className="hidden" aria-hidden="true">
            <label>
              Ne pas remplir
              <input name="company_url" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="grid gap-3">
            <label className="flex gap-3 text-sm leading-6 text-[#475569]">
              <input name="acceptCgu" type="checkbox" required className="mt-1 size-4 shrink-0 accent-[#3B82F6]" />
              J'accepte les Conditions Générales d'Utilisation et la Politique de Confidentialité. *
            </label>
            <label className="flex gap-3 text-sm leading-6 text-[#475569]">
              <input name="acceptRgpd" type="checkbox" required className="mt-1 size-4 shrink-0 accent-[#3B82F6]" />
              J'accepte que mes données personnelles soient traitées par le cabinet EJ Assurances pour
              l'étude de ma demande d'assurance. *
            </label>
            <label className="flex gap-3 text-sm leading-6 text-[#475569]">
              <input name="acceptContactPartenaires" type="checkbox" className="mt-1 size-4 shrink-0 accent-[#3B82F6]" />
              J'accepte d'être recontacté(e) par un membre du cabinet EJ Assurances ou l'un de ses
              partenaires pour le suivi de mon dossier.
            </label>
          </div>

          <button type="submit" className="btn-primary mt-2 w-full text-white">
            Envoyer ma demande
          </button>
        </form>
      </section>
      </main>
      <SiteFooter />
    </>
  );
}
