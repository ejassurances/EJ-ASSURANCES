"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Upload, Download, Trash2, Loader2, Check, X } from "lucide-react";
import {
  listPartnerDocuments,
  uploadPartnerDocument,
  deletePartnerDocument,
  getPartnerDocumentSignedUrl,
  type PartnerDocument,
} from "@/lib/actions/partner-documents";

// Documents attendus par offre (grossiste / assureur emprunteur).
const REQUIRED_DOCS: { type: string; label: string; required: boolean }[] = [
  { type: "conditions_generales", label: "Conditions générales", required: true },
  { type: "ipid", label: "IPID", required: true },
  { type: "fiche_produit", label: "Fiche produit", required: false },
  { type: "notice", label: "Notice", required: false },
];

type Props = {
  partnerId: string;
  contractId: string;
  productName: string;
  productCategory: string;
};

export function PartnerOfferDocuments({ partnerId, contractId, productName, productCategory }: Props) {
  const [docs, setDocs] = useState<PartnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    listPartnerDocuments(contractId)
      .then((d) => { if (active) setDocs(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contractId]);

  function reload() {
    listPartnerDocuments(contractId).then(setDocs);
  }

  async function handleFile(docType: string, file: File) {
    setError(null);
    setUploadingType(docType);
    const fd = new FormData();
    fd.append("partnerId", partnerId);
    fd.append("contractId", contractId);
    fd.append("productName", productName);
    fd.append("productCategory", productCategory);
    fd.append("documentType", docType);
    fd.append("file", file);
    const res = await uploadPartnerDocument(fd);
    setUploadingType(null);
    if (!res.success) { setError(res.error ?? "Échec de l'envoi."); return; }
    reload();
  }

  async function handleDownload(doc: PartnerDocument) {
    const res = await getPartnerDocumentSignedUrl(doc.id);
    if (!res.url) { setError(res.error ?? "Lien indisponible."); return; }
    const win = window.open(res.url, "_blank", "noopener,noreferrer");
    if (!win) window.location.assign(res.url);
  }

  function handleDelete(doc: PartnerDocument) {
    if (!confirm(`Supprimer « ${doc.file_name ?? doc.document_type} » ?`)) return;
    startTransition(async () => {
      const res = await deletePartnerDocument(doc.id, partnerId);
      if (res.success) setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      else setError(res.error ?? "Suppression impossible.");
    });
  }

  const byType = (type: string) => docs.find((d) => d.document_type === type && d.storage_path);

  if (loading) {
    return <p className="pt-doc-loading"><Loader2 size={13} className="bo-spin" aria-hidden /> Chargement des documents…</p>;
  }

  return (
    <div className="pt-doc-slots">
      {error && <p className="bo-formerror" style={{ marginBottom: 8 }}>{error}</p>}
      {REQUIRED_DOCS.map(({ type, label, required }) => {
        const doc = byType(type);
        return (
          <div key={type} className={`pt-doc-slot${doc ? " ok" : required ? " miss" : ""}`}>
            <span className="pt-doc-slot-ic">{doc ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}</span>
            <span className="pt-doc-slot-lbl">{label}{!required && <em> (optionnel)</em>}</span>
            {doc ? (
              <span className="pt-doc-slot-actions">
                <button type="button" onClick={() => handleDownload(doc)} title="Ouvrir"><Download size={14} aria-hidden /></button>
                <button type="button" onClick={() => handleDelete(doc)} disabled={pending} title="Supprimer"><Trash2 size={13} aria-hidden /></button>
              </span>
            ) : (
              <label className="pt-doc-slot-up">
                {uploadingType === type ? <Loader2 size={13} className="bo-spin" aria-hidden /> : <Upload size={13} aria-hidden />}
                {uploadingType === type ? "Envoi…" : "Téléverser"}
                <input
                  ref={(el) => { inputs.current[type] = el; }}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(type, f); e.target.value = ""; }}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
