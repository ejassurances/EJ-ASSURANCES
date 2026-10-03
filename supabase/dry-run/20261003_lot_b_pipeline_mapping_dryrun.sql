-- Lot technique B — DRY-RUN du mapping pipeline_stage (LECTURE SEULE).
--   Ne modifie RIEN. À exécuter dans l'éditeur SQL Supabase (projet CRM) AVANT
--   d'appliquer le backfill, pour revoir dossier par dossier les cas ambigus.
--
--   Pour chaque projet : statut actuel, workflow_stage, étape la plus avancée
--   (project_workflow_steps non 'todo'), signatures, et pipeline_stage proposé.
--   Les statuts ambigus (in_progress / proposal / signed) sont marqués
--   « À DÉCIDER » avec leurs signaux, pour décision humaine.

with etape_avancee as (
  select distinct on (s.project_id)
    s.project_id,
    s.step_key,
    s.status as step_status
  from public.project_workflow_steps s
  where s.status <> 'todo'
  order by s.project_id,
    case s.step_key
      when 'activation'   then 7
      when 'validation'   then 6
      when 'subscription' then 5
      when 'advice'       then 4
      when 'quotes'       then 3
      when 'mission'      then 2
      when 'needs'        then 1
      else 0
    end desc,
    s.position desc
),
signature as (
  select project_id, count(*) filter (where status in ('pending','sent','opened')) as en_attente,
         count(*) filter (where status = 'signed') as signees
  from public.project_signatures group by project_id
)
select
  p.id,
  p.title,
  p.project_type,
  p.status::text              as status_actuel,
  p.workflow_stage,
  ea.step_key                 as etape_la_plus_avancee,
  ea.step_status,
  coalesce(sig.en_attente, 0) as signatures_en_attente,
  coalesce(sig.signees, 0)    as signatures_signees,
  case p.status::text
    when 'draft'             then 'nouveau_a_qualifier'
    when 'qualification'     then 'qualification'
    when 'waiting_documents' then 'pieces_recueil_en_cours'
    when 'closed'            then 'termine_archive'
    when 'sans_suite'        then '(hors pipeline — reste sans_suite)'
    else 'À DÉCIDER'
  end as pipeline_stage_propose,
  case
    when p.status::text in ('in_progress','proposal','signed')
    then 'Ambigu — décider avec les signaux (workflow_stage / étape avancée / signatures)'
    else 'Direct'
  end as note
from public.projects p
left join etape_avancee ea on ea.project_id = p.id
left join signature sig on sig.project_id = p.id
order by note desc, p.created_at;

-- Récapitulatif par statut (volumétrie à backfiller vs à décider).
select status::text as status_actuel,
       count(*) as nb,
       count(*) filter (where status::text in ('in_progress','proposal','signed')) as ambigus
from public.projects
group by status::text
order by nb desc;
