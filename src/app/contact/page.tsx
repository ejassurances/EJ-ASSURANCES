import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createContactIntakeAction } from "@/app/actions/contact-intake";
import { nowMs } from "@/lib/rate-limit";

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
  // Horodatage de rendu (Server Component, calculé une fois par requête) pour l'anti-bot.
  const renderedAt = nowMs();

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
          {success && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-200">
              Votre demande est enregistrée. Le cabinet revient vers vous rapidement.
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-200">
              Impossible d'enregistrer la demande pour le moment. Vous pouvez aussi nous contacter par téléphone.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Nom
              <input name="name" required className="navy-input" placeholder="Votre nom" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Prénom
              <input name="firstName" className="navy-input" placeholder="Votre prénom" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Email
              <input name="email" type="email" required className="navy-input" placeholder="vous@exemple.fr" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#475569]">
              Téléphone
              <input name="phone" type="tel" className="navy-input" placeholder="01.89.31.40.29" />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-[#475569]">
            Montant du prêt ou patrimoine concerné
            <input name="loanAmount" inputMode="decimal" className="navy-input" placeholder="Ex. 320000" />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#475569]">
            Message
            <textarea
              name="message"
              className="navy-input min-h-36 resize-y"
              placeholder="Votre projet, votre banque, votre assurance actuelle, ou votre situation de parent social / enfant à protéger..."
            />
          </label>

          <input type="hidden" name="familySituation" value="Diagnostic protection familiale" />
          <input type="hidden" name="need" value="Assurance emprunteur ou transmission parent social" />
          <input type="hidden" name="urgency" value="Projet en cours" />

          {/* Anti-bot : horodatage de rendu (détecte les soumissions trop rapides). */}
          <input type="hidden" name="t" value={renderedAt} />
          {/* Anti-bot : honeypot — invisible pour un humain, souvent rempli par les bots. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
            <label>
              Ne pas remplir ce champ
              <input type="text" name="company_url" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="flex gap-3 text-sm leading-6 text-[#475569]">
            <input name="consent" type="checkbox" required className="mt-1 size-4 accent-[#3B82F6]" />
            J'accepte d'être recontacté par EJ Partners Assurances au sujet de ma demande.
          </label>
          <label className="flex gap-3 text-sm leading-6 text-[#475569]">
            <input name="phoneConsent" type="checkbox" className="mt-1 size-4 accent-[#3B82F6]" />
            J'accepte d'être recontacté <strong className="font-bold">par téléphone</strong> par EJ Partners Assurances.
          </label>

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
