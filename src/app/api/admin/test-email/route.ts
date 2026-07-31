import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendCrmEmail } from "@/lib/email/gmail";
import { legalSignatureHtml } from "@/lib/email/legal-signature";

export const dynamic = "force-dynamic";

// Test d'envoi Gmail : envoie un email à l'admin connecté (validation bout-en-bout).
// À ouvrir dans le navigateur en étant authentifié comme admin / courtier.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "courtier")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;">
      <p>Ceci est un <strong>email de test</strong> envoyé depuis le CRM EJ Partners Assurances.</p>
      <p>Si vous recevez ce message, l'intégration Gmail (envoi réel + délégation domaine) fonctionne.</p>
      ${legalSignatureHtml()}
    </div>`;

  const res = await sendCrmEmail({
    to: user.email,
    subject: "Test d'envoi — CRM EJ Partners Assurances",
    html,
  });

  return NextResponse.json({ to: user.email, ...res });
}
