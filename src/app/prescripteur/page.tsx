import { AppShell } from "@/components/app-shell";
import { PrescripteurDashboard } from "@/components/prescripteur-dashboard";
import { requireRole } from "@/lib/auth";

export default async function PrescripteurDashboardPage() {
  const user = await requireRole(["prescripteur"]);

  return (
    <AppShell role="prescripteur" user={user}>
      <PrescripteurDashboard user={user} />
    </AppShell>
  );
}
