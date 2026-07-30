import type { LucideIcon } from "lucide-react";
import { CheckCircle2, XCircle, AlertTriangle, FileText, Send } from "lucide-react";
import type { StatusTone } from "./status-badge";

// Vocabulaire métier des statuts, par domaine. On NE fusionne PAS les domaines
// entre eux : mêmes clés (« draft », « actif/active ») ≠ même signification.
// Seule la présentation est unifiée (StatusBadge + palette sémantique).

export type StatusConfig = { tone: StatusTone; label: string; icon?: LucideIcon };

// Statut client — fusion des anciennes maps `clients/page` + `client-file-360-live`
// (domaine et clés identiques : prospect / actif / en_cours / inactif).
export const clientStatus: Record<string, StatusConfig> = {
  prospect: { tone: "warning", label: "Prospect" },
  actif:    { tone: "success", label: "Client actif" },
  en_cours: { tone: "info",    label: "En cours" },
  inactif:  { tone: "neutral", label: "Inactif" },
};

// Statut contrat — domaine distinct du statut client (ne pas fusionner).
export const contractStatus: Record<string, StatusConfig> = {
  draft:             { tone: "neutral", label: "Brouillon" },
  active:            { tone: "success", label: "Actif" },
  pending_signature: { tone: "warning", label: "En attente signature" },
  terminated:        { tone: "danger",  label: "Résilié" },
  archived:          { tone: "neutral", label: "Archivé" },
};

// Rapprochement de commissions (Finance / bordereaux) — domaine distinct.
// Les hex ad-hoc précédents sont réalignés sur les tons sémantiques DES-001.
export const commissionStatus: Record<string, StatusConfig> = {
  match:       { tone: "success", label: "Rapproché",           icon: CheckCircle2 },
  impaye:      { tone: "danger",  label: "Impayé",              icon: XCircle },
  taux_erreur: { tone: "warning", label: "Erreur de taux",      icon: AlertTriangle },
  resilie:     { tone: "danger",  label: "Résilié non signalé", icon: AlertTriangle },
  inconnu:     { tone: "neutral", label: "Non identifié",       icon: AlertTriangle },
};

// Statut facture (Finance / facturation) — domaine distinct.
// « Envoyée » repasse du bleu résiduel (Système A) au ton info (teal).
export const invoiceStatus: Record<string, StatusConfig> = {
  brouillon: { tone: "neutral", label: "Brouillon", icon: FileText },
  envoyee:   { tone: "info",    label: "Envoyée",   icon: Send },
  encaissee: { tone: "success", label: "Encaissée", icon: CheckCircle2 },
  en_retard: { tone: "danger",  label: "En retard", icon: XCircle },
};
