import type { LucideIcon } from "lucide-react";

// Badge de statut unique de la plateforme (palette sémantique DES-001).
// Remplace les rendus ad-hoc (bo-badge inline, crm-status-badge, styles inline).
// Le vocabulaire métier (clé → ton/label) vit dans status-maps.ts, par domaine.

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "premium";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bo-badge-success",
  warning: "bo-badge-warning",
  danger: "bo-badge-danger",
  info: "bo-badge-info",
  neutral: "bo-badge-neutral",
  premium: "bo-badge-gold",
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  /** Icône Lucide optionnelle (ex. statuts finance) ; remplace la pastille. */
  icon?: LucideIcon;
  /** Pastille ronde. Par défaut affichée sauf si une icône est fournie. */
  dot?: boolean;
  className?: string;
};

export function StatusBadge({ tone, label, icon: Icon, dot, className }: StatusBadgeProps) {
  const showDot = dot ?? !Icon;
  return (
    <span className={`bo-badge ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`}>
      {Icon ? <Icon size={12} aria-hidden /> : showDot ? <span className="d" /> : null}
      {label}
    </span>
  );
}
