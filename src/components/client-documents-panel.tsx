"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip, Upload, Eye, EyeOff, Trash2, Download, FileText, Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  listClientDocuments,
  uploadClientDocument,
  toggleClientDocumentVisibility,
  deleteClientDocument,
  getClientDocumentSignedUrl,
  type ClientDocument,
} from "@/lib/actions/client-documents";
import { KYC_DOCUMENT_TYPES } from "@/lib/client-document-types";

type TypeOption = { value: string; label: string };

type Props = {
  clientId: string;
  contractId?: string;
  projectId?: string;
  /** Cabinet / mandataire : peut basculer la visibilité et tout supprimer. */
  canManage?: boolean;
  /** Vue côté client. */
  isClient?: boolean;
  /**
   * Liste des types proposés au dépôt. Dans un projet, on passe les exigences
   * documentaires du projet ; sinon on retombe sur les types KYC standard.
   */
  typeOptions?: TypeOption[];
};

function humanSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ClientDocumentsPanel({ clientId, contractId, projectId, canManage, isClient, typeOptions }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("");

  // Types proposés : exigences du projet si fournies, sinon liste KYC standard.
  const options: TypeOption[] = typeOptions && typeOptions.length > 0 ? typeOptions : KYC_DOCUMENT_TYPES;
  const typeLabel = (value: string | null) =>
    value ? options.find((o) => o.value === value)?.label ?? value : null;

  const load = useCallback(() => {
    setLoading(true);
    listClientDocuments({ clientId, contractId, projectId })
      .then((d) => setDocs(d))
      .finally(() => setLoading(false));
  }, [clientId, contractId, projectId]);

  // Chargement initial : les setState n'ont lieu qu'après résolution (pas de cascade synchrone).
  useEffect(() => {
    let active = true;
    listClientDocuments({ clientId, contractId, projectId })
      .then((d) => { if (active) setDocs(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId, contractId, projectId]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Sélectionnez un fichier."); return; }

    const fd = new FormData();
    fd.append("client_id", clientId);
    if (contractId) fd.append("contract_id", contractId);
    if (projectId) fd.append("project_id", projectId);
    if (labelRef.current?.value) fd.append("label", labelRef.current.value);
    if (docType) fd.append("doc_type", docType);
    fd.append("file", file);

    setUploading(true);
    const res = await uploadClientDocument(fd);
    setUploading(false);
    if (!res.success) { setError(res.error ?? "Échec de l'envoi."); return; }
    if (fileRef.current) fileRef.current.value = "";
    if (labelRef.current) labelRef.current.value = "";
    setDocType("");
    load();
    router.refresh(); // met à jour les badges d'exigences du projet
  }

  function handleToggle(doc: ClientDocument) {
    startTransition(async () => {
      const res = await toggleClientDocumentVisibility(doc.id, !doc.visible_to_client);
      if (res.success) {
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, visible_to_client: !d.visible_to_client } : d)));
      } else {
        setError(res.error ?? "Mise à jour impossible.");
      }
    });
  }

  async function handleDownload(doc: ClientDocument) {
    const res = await getClientDocumentSignedUrl(doc.id);
    if (!res.url) { setError(res.error ?? "Lien indisponible."); return; }
    // window.open peut être bloqué dans les webviews mobiles (« This page couldn't
    // load »). On tente un nouvel onglet, avec repli sur la navigation courante.
    const win = window.open(res.url, "_blank", "noopener,noreferrer");
    if (!win) window.location.assign(res.url);
  }

  function handleDelete(doc: ClientDocument) {
    if (!confirm(`Supprimer la pièce « ${doc.file_name} » ?`)) return;
    startTransition(async () => {
      const res = await deleteClientDocument(doc.id);
      if (res.success) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        router.refresh(); // une exigence projet peut repasser « manquante »
      } else setError(res.error ?? "Suppression impossible.");
    });
  }

  const canDelete = (doc: ClientDocument) =>
    canManage || (isClient && doc.uploaded_by_role === "client");
  // Le cabinet/mandataire peut déposer au niveau de la fiche (KYC, pièce d'identité)
  // comme au niveau d'un contrat ou d'un projet précis.
  const canUpload = canManage || Boolean(contractId || projectId);

  return (
    <div className="bo-docs">
      <div className="bo-docs-head">
        <span className="bo-docs-title"><Paperclip size={14} aria-hidden /> Pièces jointes</span>
        <span className="bo-docs-count">{docs.length}</span>
      </div>

      {error && <p className="bo-formerror" style={{ marginBottom: "10px" }}>{error}</p>}

      {loading ? (
        <p className="bo-docs-empty"><Loader2 size={14} className="bo-spin" aria-hidden /> Chargement…</p>
      ) : docs.length === 0 ? (
        <p className="bo-docs-empty">Aucune pièce pour le moment.</p>
      ) : (
        <ul className="bo-docs-list">
          {docs.map((doc) => (
            <li key={doc.id} className="bo-docs-item">
              <span className="bo-docs-ic"><FileText size={15} aria-hidden /></span>
              <button type="button" className="bo-docs-name" onClick={() => handleDownload(doc)} title="Ouvrir">
                <span className="bo-docs-fn">
                  {doc.label || doc.file_name}
                  {typeLabel(doc.doc_type) && <span className="bo-docs-type">{typeLabel(doc.doc_type)}</span>}
                </span>
                <span className="bo-docs-meta">
                  {humanSize(doc.size_bytes)}
                  {doc.uploaded_by_role === "client" ? " · déposé par le client" : ""}
                </span>
              </button>

              {canManage ? (
                <button
                  type="button"
                  className={`bo-docs-vis${doc.visible_to_client ? " is-on" : ""}`}
                  onClick={() => handleToggle(doc)}
                  disabled={pending}
                  title={doc.visible_to_client ? "Visible par le client — cliquer pour masquer" : "Interne — cliquer pour rendre visible"}
                >
                  {doc.visible_to_client ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                  {doc.visible_to_client ? "Visible client" : "Interne"}
                </button>
              ) : (
                doc.visible_to_client && <StatusBadge tone="info" label="Partagé par le cabinet" />
              )}

              <button type="button" className="bo-docs-dl" onClick={() => handleDownload(doc)} aria-label="Télécharger">
                <Download size={15} aria-hidden />
              </button>
              {canDelete(doc) && (
                <button type="button" className="bo-docs-del" onClick={() => handleDelete(doc)} disabled={pending} aria-label="Supprimer">
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <>
          <form className="bo-docs-upload" onSubmit={handleUpload}>
            <select
              className="bo-input bo-docs-type-select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              aria-label="Type de document"
            >
              <option value="">Type de document…</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input ref={fileRef} type="file" className="bo-docs-file"
              accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Fichier à joindre" />
            <input ref={labelRef} type="text" className="bo-input bo-docs-label" placeholder="Libellé (optionnel)" />
            <button type="submit" className="bo-btn bo-btn-primary bo-docs-add" disabled={uploading}>
              {uploading ? <Loader2 size={14} className="bo-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              {uploading ? "Envoi…" : "Ajouter"}
            </button>
          </form>
          {canManage && (
            <p className="bo-docs-hint">Une pièce ajoutée est <strong>interne</strong> par défaut. Activez « Visible client » pour la partager.</p>
          )}
        </>
      )}
    </div>
  );
}
