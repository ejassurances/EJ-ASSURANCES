-- Lot technique B — Modèle Dossier / Pipeline : STRUCTURE (additive, réversible).
--   Source de vérité métier : Notion « Lot technique B — Modèle Dossier / Pipeline ».
--   Décision validée : champ additif `pipeline_stage` (14 étapes) SANS réécrire
--   l'enum `public.project_status`. Aucune donnée réécrite ici (voir le backfill
--   dans la migration dédiée, après dry-run validé).
--
-- Principe (Lot 1 fonctionnel) : séparer « où en est le dossier » (pipeline_stage),
--   « pourquoi il n'avance pas » (project_blocages, distinct du statut) et
--   « quelle est la prochaine action / qui agit » (prochaine_action*).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Statut principal canonique — 14 étapes (champ additif, nullable).
--    Nullable volontairement : les dossiers `sans_suite` restent hors pipeline
--    (représentés par project_status), et les cas ambigus restent NULL jusqu'à
--    assignation validée.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists pipeline_stage text;

alter table public.projects drop constraint if exists projects_pipeline_stage_check;
alter table public.projects
  add constraint projects_pipeline_stage_check
  check (pipeline_stage is null or pipeline_stage in (
    'nouveau_a_qualifier',
    'qualification',
    'pieces_recueil_en_cours',
    'conformite_a_verifier',
    'lettre_mission',
    'demandes_devis',
    'analyse_recommandation',
    'fic_a_valider',
    'fic_envoye_signature',
    'souscription_a_lancer',
    'suivi_compagnie',
    'contrat_actif',
    'post_vente_suivi',
    'termine_archive'
  ));

create index if not exists projects_pipeline_stage_idx on public.projects (pipeline_stage);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Prochaine action + qui doit agir (distinct du statut et du blocage).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists prochaine_action text;
alter table public.projects
  add column if not exists prochaine_action_role text;

alter table public.projects drop constraint if exists projects_prochaine_action_role_check;
alter table public.projects
  add constraint projects_prochaine_action_role_check
  check (prochaine_action_role is null or prochaine_action_role in (
    'agent', 'humain', 'client', 'compagnie', 'partenaire'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. État de blocage DISTINCT du statut (historisé). Un dossier conserve son
--    étape (pipeline_stage) ET peut porter un ou plusieurs blocages.
--    Un échec technique d'un contrôle conformité est un blocage, jamais un
--    contrôle positif (cf. règle sécurité).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.project_blocages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actif boolean not null default true,
  motif text not null,
  element_attendu text,
  responsable text check (responsable is null or responsable in (
    'agent', 'humain', 'client', 'compagnie', 'partenaire'
  )),
  prochaine_action text,
  created_at timestamptz not null default now(),
  created_by uuid,
  resolved_at timestamptz,
  resolved_by uuid
);

-- Au plus un blocage actif « courant » facilement requêtable.
create index if not exists project_blocages_actif_idx
  on public.project_blocages (project_id) where actif;
create index if not exists project_blocages_project_idx
  on public.project_blocages (project_id);

alter table public.project_blocages enable row level security;

-- RLS staff-only (admin/courtier), aligné sur le reste du schéma.
drop policy if exists "Staff manage project_blocages" on public.project_blocages;
create policy "Staff manage project_blocages" on public.project_blocages
  for all to authenticated
  using (app_private.is_staff())
  with check (app_private.is_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fonction de validation des transitions (helper réutilisable).
--    NON câblée en trigger ici : additif et non bloquant tant que le code
--    applicatif n'écrit pas encore `pipeline_stage`. L'enforcement (trigger ou
--    garde-fou serveur) sera activé avec la couche applicative du lot.
--    Règle : on peut rester sur place, avancer d'une étape, corriger en arrière,
--    ou terminer/archiver ; on ne « saute » pas d'étape vers l'avant.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_valid_pipeline_transition(p_old text, p_new text)
returns boolean
language sql
immutable
as $$
  with ordre(stage, rang) as (
    values
      ('nouveau_a_qualifier', 1), ('qualification', 2), ('pieces_recueil_en_cours', 3),
      ('conformite_a_verifier', 4), ('lettre_mission', 5), ('demandes_devis', 6),
      ('analyse_recommandation', 7), ('fic_a_valider', 8), ('fic_envoye_signature', 9),
      ('souscription_a_lancer', 10), ('suivi_compagnie', 11), ('contrat_actif', 12),
      ('post_vente_suivi', 13), ('termine_archive', 14)
  )
  select case
    when p_new is null then true
    when p_old is null then true
    when p_new = 'termine_archive' then true           -- clôture/archivage toujours permis
    else coalesce(
      (select n.rang from ordre n where n.stage = p_new)
        <= (select o.rang from ordre o where o.stage = p_old) + 1,  -- avance d'au plus 1, recul permis
      false
    )
  end;
$$;
