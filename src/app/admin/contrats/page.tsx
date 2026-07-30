import { AppShell } from "@/components/app-shell";
import { ContractsView, type ContractRow } from "@/components/contracts-view";
import { requireRole } from "@/lib/auth";
import { getContractsList } from "@/lib/actions/contracts";

export const metadata = {
  title: "Contrats — EJ Partners Assurances Admin",
};

export default async function AdminContractsPage() {
  const user = await requireRole(["admin", "courtier"]);
  const contracts = (await getContractsList()) as unknown as ContractRow[];

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      <ContractsView contracts={contracts} />
    </AppShell>
  );
}
