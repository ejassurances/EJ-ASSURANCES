import { AppShell } from "@/components/app-shell";
import { MandataireDashboard } from "@/components/mandataire-dashboard";
import { requireRole } from "@/lib/auth";
import { getAccessibleClients } from "@/lib/clients";

export default async function MandataireDashboardPage() {
  const user = await requireRole(["mandataire"]);
  const clients = await getAccessibleClients(user);

  return (
    <AppShell role="mandataire" user={user}>
      <MandataireDashboard clients={clients} user={user} />
    </AppShell>
  );
}
