import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractDetail, type ContractDetailData } from "@/components/contract-detail";
import { requireRole } from "@/lib/auth";
import { getContract } from "@/lib/actions/contracts";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) return { title: "Contrat — EJ Partners Assurances Admin" };
  const contract = await getContract(id);
  return { title: `${contract?.contract_number ?? "Contrat"} — EJ Partners Assurances Admin` };
}

export default async function AdminContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(["admin", "courtier"]).catch(() => null);
  if (!user) redirect("/connexion");

  const contract = (await getContract(id)) as unknown as ContractDetailData | null;
  if (!contract) notFound();

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      <ContractDetail contract={contract} />
    </AppShell>
  );
}
