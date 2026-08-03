"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type PartnerApiIntegration = {
  id: string;
  partner_id: string;
  name: string;
  typologies: string[];
  protocol: "rest" | "soap";
  environment: "sandbox" | "production" | "unknown";
  base_url: string | null;
  wsdl_url: string | null;
  operations: string[];
  endpoints: Record<string, string>;
  auth_mode: string;
  login_identifier: string | null;
  secret_env_var: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerApiResult = { success: boolean; error?: string; id?: string };

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function listPartnerApiIntegrations(partnerId: string): Promise<PartnerApiIntegration[]> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("partner_api_integrations")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as PartnerApiIntegration[];
}

// Crée ou met à jour une intégration API. Aucun secret n'est enregistré : seuls la
// configuration et le nom de la variable d'environnement contenant le secret le sont.
export async function upsertPartnerApiIntegration(formData: FormData): Promise<PartnerApiResult> {
  const user = await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };

  const id = ((formData.get("id") as string) || "").trim() || null;
  const partnerId = String(formData.get("partnerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!partnerId) return { success: false, error: "Partenaire manquant." };
  if (!name) return { success: false, error: "Le nom de l'intégration est obligatoire." };

  const typologies = formData.getAll("typologies").map(String).filter(Boolean);
  const protocol = (String(formData.get("protocol") ?? "rest") === "soap" ? "soap" : "rest") as
    | "soap"
    | "rest";
  const environment = String(formData.get("environment") ?? "sandbox");
  const authMode = String(formData.get("authMode") ?? "none");
  const status = String(formData.get("status") ?? "not_configured");

  const endpoints: Record<string, string> = {};
  const quote = String(formData.get("quoteEndpoint") ?? "").trim();
  const subscription = String(formData.get("subscriptionEndpoint") ?? "").trim();
  const webhook = String(formData.get("webhookEndpoint") ?? "").trim();
  if (quote) endpoints.quote = quote;
  if (subscription) endpoints.subscription = subscription;
  if (webhook) endpoints.webhook = webhook;

  const row = {
    partner_id: partnerId,
    name,
    typologies,
    protocol,
    environment,
    base_url: (String(formData.get("baseUrl") ?? "").trim() || null) as string | null,
    wsdl_url: (String(formData.get("wsdlUrl") ?? "").trim() || null) as string | null,
    operations: splitList(String(formData.get("operations") ?? "")),
    endpoints,
    auth_mode: authMode,
    login_identifier: (String(formData.get("loginIdentifier") ?? "").trim() || null) as string | null,
    secret_env_var: (String(formData.get("secretEnvVar") ?? "").trim() || null) as string | null,
    status,
    notes: (String(formData.get("notes") ?? "").trim() || null) as string | null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("partner_api_integrations").update(row).eq("id", id);
    if (error) return { success: false, error: "Enregistrement impossible." };
    revalidatePath(`/admin/partenaires/${partnerId}`);
    return { success: true, id };
  }

  const { data, error } = await supabase
    .from("partner_api_integrations")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: "Création impossible." };
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: true, id: data.id as string };
}

export async function deletePartnerApiIntegration(id: string, partnerId: string): Promise<PartnerApiResult> {
  await requireRole(["admin", "courtier"]);
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { success: false, error: "Service indisponible." };
  const { error } = await supabase.from("partner_api_integrations").delete().eq("id", id);
  if (error) return { success: false, error: "Suppression impossible." };
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: true };
}
