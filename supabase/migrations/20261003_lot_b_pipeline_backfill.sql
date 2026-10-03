-- Lot technique B — BACKFILL de `pipeline_stage` (migration de données).
--   ⚠️ À appliquer APRÈS la structure (20261003_lot_b_pipeline_structure.sql) ET
--   APRÈS revue du dry-run (supabase/dry-run/20261003_lot_b_pipeline_mapping_dryrun.sql).
--
--   Ne backfille QUE les correspondances NON AMBIGUËS, et seulement là où
--   pipeline_stage est encore NULL (idempotent, ne réécrit jamais une valeur
--   déjà posée). Les statuts ambigus (in_progress / proposal / signed) ne sont
--   PAS backfillés automatiquement : ils dépendent de signaux par dossier
--   (workflow_stage + project_workflow_steps) et doivent être assignés après
--   validation humaine (cf. dry-run). `sans_suite` reste hors pipeline (NULL).
--
--   Préserve les données : aucune colonne existante n'est modifiée, seul
--   pipeline_stage (nouveau, nullable) est renseigné.

update public.projects
set pipeline_stage = case status::text
    when 'draft'             then 'nouveau_a_qualifier'
    when 'qualification'     then 'qualification'
    when 'waiting_documents' then 'pieces_recueil_en_cours'
    when 'closed'            then 'termine_archive'
  end
where pipeline_stage is null
  and status::text in ('draft', 'qualification', 'waiting_documents', 'closed');

-- in_progress / proposal / signed  → laissés NULL (assignation validée via dry-run).
-- sans_suite                        → laissé NULL (issue terminale hors pipeline).
