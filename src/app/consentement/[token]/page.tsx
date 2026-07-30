import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { PhoneConsentConfirm } from "@/components/phone-consent-confirm";
import { verifyConsentToken } from "@/lib/consent-token";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Confirmation de consentement — EJ Partners Assurances",
  robots: { index: false, follow: false },
};

export default async function ConsentementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const clientId = verifyConsentToken(token);

  let valid = Boolean(clientId);
  let fullName: string | null = null;

  if (clientId) {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const { data } = await supabase.from("clients").select("full_name").eq("id", clientId).maybeSingle();
      if (!data) valid = false;
      else fullName = (data.full_name as string) ?? null;
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="public-main">
        <div className="tunnel-wrapper">
          {valid ? (
            <PhoneConsentConfirm token={token} fullName={fullName} />
          ) : (
            <div className="tunnel-section">
              <div className="tunnel-section__header">
                <p className="eyebrow">Consentement téléphonique</p>
                <h2>Lien invalide ou expiré</h2>
                <p className="tunnel-section__desc">
                  Ce lien de confirmation n'est plus valide. Contactez le cabinet à
                  contact@ej-assurances.fr si vous souhaitez mettre à jour vos préférences.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
