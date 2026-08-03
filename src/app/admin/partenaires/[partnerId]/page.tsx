import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import {
  createPartnerDistributedContractAction,
  generatePartnerContractAiSummaryAction,
  getPartnerCompany,
} from "@/lib/actions/partners";
import { listPartnerApiIntegrations } from "@/lib/actions/partner-api";
import { PartnerOfferDocuments } from "@/components/partner-offer-documents";
import { PartnerApiIntegrations } from "@/components/partner-api-integrations";
import { Bot, Building2, Plus, ShieldCheck } from "lucide-react";

export const metadata = { title: "Fiche partenaire - EJ Partners Assurances" };

const productCategories = [
  ["assurance_emprunteur", "Assurance emprunteur"],
  ["prevoyance", "Prévoyance"],
  ["assurance_vie", "Assurance vie"],
  ["sante", "Santé"],
  ["protection_juridique", "Protection juridique"],
  ["trottinette", "Trottinette / EDPM"],
  ["autre", "Autre"],
];
const categoryLabel = (v: string) => productCategories.find(([k]) => k === v)?.[1] ?? v;

export default async function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireRole(["admin", "courtier"]);
  const { partnerId } = await params;
  const partner = await getPartnerCompany(partnerId);
  if (!partner) notFound();

  const integrations = await listPartnerApiIntegrations(partnerId);
  const contracts = partner.partner_distributed_contracts ?? [];

  async function addDistributedContract(formData: FormData) {
    "use server";
    await createPartnerDistributedContractAction({ status: "idle", message: "" }, formData);
  }
  async function generateAiSummary(formData: FormData) {
    "use server";
    await generatePartnerContractAiSummaryAction(formData);
  }

  return (
    <AppShell role={user.role === "courtier" ? "courtier" : "admin"} user={user}>
      <div className="pt-crumb">
        <Link href="/admin">Accueil</Link> <span>/</span> <Link href="/admin/partenaires">Partenaires</Link> <span>/</span> <b>{partner.name}</b>
      </div>

      <div className="pt-hero">
        <div>
          <p className="pt-hero-eyebrow">Fiche partenaire · {partner.partner_type}</p>
          <h1>{partner.name}</h1>
          {partner.notes && <p>{partner.notes}</p>}
          <div className="pt-hero-badges">
            <span className="pt-hb">● {partner.status}</span>
            {partner.orias_number && <span className="pt-hb">ORIAS {partner.orias_number}</span>}
            <span className="pt-hb">{contracts.length} offre{contracts.length !== 1 ? "s" : ""}</span>
            {integrations.length > 0 && <span className="pt-hb">{integrations.length} API</span>}
          </div>
        </div>
      </div>

      <div className="pt-cards">
        <div className="pt-card">
          <h2><ShieldCheck size={15} aria-hidden /> Informations</h2>
          <div className="pt-kv"><span className="k">Type</span><span className="v">{partner.partner_type}</span></div>
          <div className="pt-kv"><span className="k">ORIAS</span><span className="v">{partner.orias_number ?? "Non renseigné"}</span></div>
          <div className="pt-kv"><span className="k">Site</span><span className="v">{partner.website ? <a href={partner.website} target="_blank" rel="noreferrer">{partner.website}</a> : "Non renseigné"}</span></div>
          <div className="pt-kv"><span className="k">Convention signée</span><span className="v">{partner.convention_signed_at ?? "À vérifier"}</span></div>
        </div>
        <div className="pt-card">
          <h2><Building2 size={15} aria-hidden /> Contacts utiles</h2>
          <div className="pt-kv"><span className="k">Commercial</span><span className="v">{partner.commercial_contact?.name || partner.commercial_contact?.email || "Non renseigné"}</span></div>
          <div className="pt-kv"><span className="k">Sinistre</span><span className="v">{partner.claims_contact?.name || partner.claims_contact?.email || "Non renseigné"}</span></div>
          <div className="pt-kv"><span className="k">Réclamation</span><span className="v">{partner.complaints_contact?.name || partner.complaints_contact?.email || "Non renseigné"}</span></div>
          <div className="pt-kv"><span className="k">Inspecteur</span><span className="v">{partner.inspector_contact?.name || partner.inspector_contact?.email || "Non renseigné"}</span></div>
        </div>
      </div>

      {/* ── Catalogue ── */}
      <section className="pt-section">
        <div className="pt-sec-head">
          <div><p className="pt-eyebrow">Catalogue</p><h2>Offres distribuées</h2></div>
          <span className="pt-count">{contracts.length}</span>
        </div>

        {contracts.length === 0 ? (
          <div className="pt-empty">Aucune offre distribuée. Ajoutez-en une ci-dessous.</div>
        ) : (
          <div className="pt-offers">
            {contracts.map((contract) => (
              <article key={contract.id} className="pt-offer">
                <div className="pt-offer-top">
                  <div>
                    <span className="pt-offer-name">
                      {contract.contract_name}
                      {contract.insurer_name && <span className="pt-porteur">Assureur : {contract.insurer_name}</span>}
                    </span>
                    <div className="pt-offer-cible">
                      {contract.advice_positioning || contract.target_clients?.join(", ") || "Cible à qualifier"}
                      {contract.commission_rate ? ` · commission ${contract.commission_rate}%` : ""}
                    </div>
                  </div>
                  <span className="pt-cat">{categoryLabel(contract.product_category)}</span>
                </div>

                <PartnerOfferDocuments
                  partnerId={partner.id}
                  contractId={contract.id}
                  productName={contract.contract_name}
                  productCategory={contract.product_category}
                />

                <div className="pt-offer-foot">
                  <form action={generateAiSummary}>
                    <input type="hidden" name="partnerId" value={partner.id} />
                    <input type="hidden" name="contractId" value={contract.id} />
                    <button type="submit" className="pt-btn-ghost"><Bot size={14} aria-hidden /> Analyser avec IA</button>
                  </form>
                  {contract.subscription_link && (
                    <a href={contract.subscription_link} target="_blank" rel="noreferrer" className="pt-btn-ghost">Lien de souscription</a>
                  )}
                </div>

                {contract.ai_guarantee_summary && (
                  <div className="pt-ai"><Bot size={14} aria-hidden /> <span>{contract.ai_guarantee_summary}</span></div>
                )}
              </article>
            ))}
          </div>
        )}

        {/* Ajouter une offre */}
        <form action={addDistributedContract} className="pt-offer-form">
          <input type="hidden" name="partnerId" value={partner.id} />
          <input type="hidden" name="sourceContext" value="partner_file" />
          <h3><Plus size={15} aria-hidden /> Ajouter une offre</h3>
          <div className="pt-row">
            <div className="pt-fg"><label>Nom de l&apos;offre</label><input name="contractName" placeholder="Ex : Prévoir ELIT'" required /></div>
            <div className="pt-fg"><label>Assureur porteur</label><input name="insurerName" placeholder="Ex : Prévoir, Malakoff Humanis…" /></div>
          </div>
          <div className="pt-row">
            <div className="pt-fg">
              <label>Catégorie</label>
              <select name="productCategory" defaultValue="assurance_emprunteur">
                {productCategories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="pt-fg"><label>Code produit</label><input name="productCode" placeholder="Optionnel" /></div>
          </div>
          <div className="pt-fg"><label>Cible / positionnement devoir de conseil</label><input name="advicePositioning" placeholder="Ex : jeunes couples & gros capitaux, avec ou sans sélection médicale" /></div>
          <div className="pt-row">
            <div className="pt-fg"><label>Taux de commission</label><input name="commissionRate" inputMode="decimal" placeholder="Ex : 40" /></div>
            <div className="pt-fg"><label>Lien de souscription</label><input name="subscriptionLink" type="url" placeholder="https://…" /></div>
          </div>
          <button type="submit" className="pt-add">Ajouter au catalogue</button>
        </form>
      </section>

      {/* ── Intégrations API ── */}
      <PartnerApiIntegrations partnerId={partner.id} integrations={integrations} />
    </AppShell>
  );
}
