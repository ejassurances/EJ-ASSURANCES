"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

// Pièces requises côté prospect (alignées sur l'API /api/prospect/upload-document).
const PIECES = [
  { type: "CNI_PASSEPORT", label: "Pièce d'identité (CNI / Passeport)" },
  { type: "RIB", label: "RIB / IBAN" },
  { type: "RELEVE_INFORMATION", label: "Relevé d'information assurance" },
  { type: "JUSTIFICATIF_DOMICILE", label: "Justificatif de domicile" },
  { type: "BULLETIN_SALAIRE", label: "Bulletin de salaire" },
] as const;

type PieceType = (typeof PIECES)[number]["type"];
type PieceState = "idle" | "uploading" | "processing" | "received" | "error";

interface PieceStatus {
  state: PieceState;
  progress: number;
  error?: string;
}

interface Props {
  clientFolderId: string | null;
  // Statuts initiaux issus du CRM : 'processing' (🟡) ou 'received' (🟢).
  initialStatuses?: Partial<Record<PieceType, "processing" | "received">>;
}

// Lit un fichier et renvoie son contenu en Base64 (sans le préfixe data:).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

export function ProspectDocumentUpload({ clientFolderId, initialStatuses = {} }: Props) {
  const [statuses, setStatuses] = useState<Record<string, PieceStatus>>(() => {
    const init: Record<string, PieceStatus> = {};
    for (const p of PIECES) {
      const s = initialStatuses[p.type];
      init[p.type] = { state: s ?? "idle", progress: s === "received" ? 100 : 0 };
    }
    return init;
  });
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  function setPiece(type: PieceType, patch: Partial<PieceStatus>) {
    setStatuses((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  async function handleFile(type: PieceType, file: File) {
    if (!clientFolderId) {
      setPiece(type, { state: "error", error: "Dossier Drive indisponible" });
      return;
    }
    setPiece(type, { state: "uploading", progress: 0, error: undefined });

    let fileBlobBase64: string;
    try {
      fileBlobBase64 = await fileToBase64(file);
    } catch {
      setPiece(type, { state: "error", error: "Lecture du fichier impossible" });
      return;
    }

    // XHR pour disposer d'une vraie barre de progression à l'upload.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/prospect/upload-document");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPiece(type, { progress: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Déposé → en cours de traitement (le webhook Drive confirmera la réception).
        setPiece(type, { state: "processing", progress: 100 });
      } else {
        let msg = "Échec du dépôt";
        try {
          msg = JSON.parse(xhr.responseText)?.error ?? msg;
        } catch {
          /* réponse non-JSON */
        }
        setPiece(type, { state: "error", error: msg });
      }
    };
    xhr.onerror = () => setPiece(type, { state: "error", error: "Erreur réseau" });
    xhr.send(
      JSON.stringify({
        clientFolderId,
        typePiece: type,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBlobBase64,
      }),
    );
  }

  function badgeFor(s: PieceState) {
    if (s === "received") return <StatusBadge tone="success" label="🟢 Reçu dans le dossier" />;
    if (s === "processing") return <StatusBadge tone="warning" label="🟡 En cours de traitement" />;
    if (s === "error") return <StatusBadge tone="danger" label="Échec — réessayez" />;
    return <StatusBadge tone="neutral" label="À déposer" />;
  }

  return (
    <section className="bo-ec-card">
      <div className="bo-ec-card-h">
        <span className="bo-ec-dot">
          <UploadCloud size={16} aria-hidden />
        </span>
        <h3>Mes pièces justificatives</h3>
      </div>

      {!clientFolderId && (
        <p style={{ color: "var(--muted)", fontSize: "13px", margin: "0 0 8px" }}>
          Votre dossier est en cours de création. Le dépôt de pièces sera disponible très
          prochainement — votre conseiller vous préviendra.
        </p>
      )}

      <div style={{ display: "grid", gap: "14px" }}>
        {PIECES.map((p) => {
          const st = statuses[p.type];
          const busy = st.state === "uploading";
          return (
            <div key={p.type} className="bo-ec-row" style={{ alignItems: "stretch" }}>
              <div style={{ flex: 1 }}>
                <p className="bo-ec-lab" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {st.state === "received" && <FileCheck2 size={14} aria-hidden />}
                  {p.label}
                </p>
                {busy && (
                  <div
                    aria-hidden
                    style={{
                      marginTop: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: "#E2E8F0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${st.progress}%`,
                        background: "#3B82F6",
                        transition: "width 0.2s",
                      }}
                    />
                  </div>
                )}
                {st.state === "error" && st.error && (
                  <p className="bo-ec-rsub" style={{ color: "#DC2626" }}>
                    {st.error}
                  </p>
                )}
              </div>

              <span className="bo-ec-right" style={{ gap: "10px" }}>
                {badgeFor(st.state)}
                <input
                  ref={(el) => {
                    inputs.current[p.type] = el;
                  }}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(p.type, f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="bo-ec-link"
                  disabled={busy || !clientFolderId}
                  onClick={() => inputs.current[p.type]?.click()}
                >
                  {st.state === "received" ? "Remplacer" : "Déposer"}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
