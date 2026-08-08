-- Automatisation du criblage « gel des avoirs » (LCB-FT).
--   - Table miroir du registre national (source : DGTrésor, flux JSON public).
--   - Fonction de rapprochement flou (pg_trgm) client ↔ registre.
--   - Trigger sur clients qui déclenche le criblage (via Edge Function).
--   - (Optionnel) planification pg_cron de la synchro quotidienne.
--
-- Structure du flux (déduite de l'API réelle
-- https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-flux-json) :
--   Publications.DatePublication
--   Publications.PublicationDetail[] : { IdRegistre, Nature, Nom, RegistreDetail[] }
--     RegistreDetail[] : { TypeChamp, Valeur[] } avec TypeChamp ∈
--       PRENOM, ALIAS, SEXE, DATE_DE_NAISSANCE, LIEU_DE_NAISSANCE, NATIONALITE,
--       ADRESSE_PP/PM, PASSEPORT, IDENTIFICATION, REFERENCE_ONU/UE,
--       FONDEMENT_JURIDIQUE (régime de sanction), MOTIFS, etc.

create extension if not exists pg_trgm;
create extension if not exists pg_net;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table miroir du registre national.
--    Champs à plat pour le rapprochement + copie brute (registre_detail) pour ne
--    rien perdre. La clé primaire est l'identifiant Trésor (upsert idempotent).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.gel_avoirs_registre (
  id_registre integer primary key,                 -- IdRegistre (Trésor)
  nature text,                                      -- Personne physique / morale / Navire
  nom text,                                         -- Nom / dénomination
  prenoms text[],                                   -- TypeChamp PRENOM
  alias text[],                                     -- TypeChamp ALIAS
  sexe text,                                        -- TypeChamp SEXE
  dates_naissance jsonb,                            -- DATE_DE_NAISSANCE [{Jour,Mois,Annee}]
  annees_naissance integer[],                       -- années extraites (désambiguïsation homonymes)
  lieux_naissance text[],                           -- LIEU_DE_NAISSANCE
  nationalites text[],                              -- NATIONALITE
  fondements_juridiques jsonb,                      -- FONDEMENT_JURIDIQUE (régime de sanction)
  references_onu text[],                            -- REFERENCE_ONU
  references_ue text[],                             -- REFERENCE_UE
  motifs text,                                      -- MOTIFS
  registre_detail jsonb not null default '[]'::jsonb, -- copie brute du RegistreDetail
  search_text text,                                 -- normalisé (nom+prénoms+alias, sans accents, minuscule)
  date_publication timestamptz,                     -- DatePublication du flux
  synced_at timestamptz not null default now()
);

-- Index trigram pour le rapprochement flou sur le nom normalisé.
create index if not exists gel_avoirs_search_trgm
  on public.gel_avoirs_registre using gin (search_text gin_trgm_ops);
create index if not exists gel_avoirs_nature_idx
  on public.gel_avoirs_registre (nature);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS staff-only (admin/courtier).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.gel_avoirs_registre enable row level security;
drop policy if exists "Staff read gel_avoirs" on public.gel_avoirs_registre;
create policy "Staff read gel_avoirs" on public.gel_avoirs_registre for select to authenticated
  using (app_private.is_staff());
-- Écriture réservée au service role (Edge Function de synchro) → aucune policy
-- authenticated en écriture : seul le service_role (qui bypass RLS) upsert.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rapprochement flou : renvoie les entrées du registre proches d'un nom donné.
--    p_search doit être fourni déjà normalisé (minuscule, sans accents) par l'appelant.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.match_gel_avoirs(p_search text, p_threshold real default 0.35)
returns table (
  id_registre integer,
  nom text,
  nature text,
  score real,
  annees_naissance integer[],
  nationalites text[],
  fondements_juridiques jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select g.id_registre, g.nom, g.nature,
         similarity(g.search_text, p_search) as score,
         g.annees_naissance, g.nationalites, g.fondements_juridiques
  from public.gel_avoirs_registre g
  where g.search_text is not null
    and similarity(g.search_text, p_search) >= p_threshold
  order by score desc
  limit 20;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger de criblage automatique sur clients (insert / MAJ nom / date de naissance).
--    Appelle l'Edge Function ai-agent-gemini (action gel_avoirs_screening) via pg_net.
--
--    SÉCURITÉ : ai-agent-gemini exige désormais le service_role (la clé anon est
--    rejetée). On lit la clé service role depuis Vault (jamais en dur dans le repo).
--    ⚠️ Pré-requis (à faire UNE fois, hors repo) :
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--    Si le secret est absent, le trigger n'appelle rien (il ne bloque JAMAIS l'insert).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.on_client_screen_gel_avoirs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text;
begin
  begin
    select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  exception when others then
    service_key := null;
  end;

  if service_key is null then
    raise warning 'gel_avoirs: secret Vault "service_role_key" absent, criblage non déclenché pour client %', new.id;
    return new;
  end if;

  perform net.http_post(
    url     := 'https://huneukcmqaftwhidyegi.supabase.co/functions/v1/ai-agent-gemini',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('action', 'gel_avoirs_screening', 'client_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_client_gel_avoirs on public.clients;
create trigger trg_client_gel_avoirs
  after insert or update of full_name, date_naissance on public.clients
  for each row execute function public.on_client_screen_gel_avoirs();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. (Optionnel) Synchro quotidienne via pg_cron.
--    Le registre est mis à jour irrégulièrement par le Trésor ; une passe/jour
--    (proposée à 05:00 UTC) est un bon compromis fraîcheur / charge.
--    Nécessite pg_cron + le secret Vault 'service_role_key'. Non fatal si pg_cron
--    n'est pas disponible dans l'environnement.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('gel-avoirs-daily-sync')
      where exists (select 1 from cron.job where jobname = 'gel-avoirs-daily-sync');
    perform cron.schedule(
      'gel-avoirs-daily-sync',
      '0 5 * * *',
      $cron$
      select net.http_post(
        url     := 'https://huneukcmqaftwhidyegi.supabase.co/functions/v1/sync-gel-avoirs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
        ),
        body    := '{}'::jsonb
      );
      $cron$
    );
  else
    raise notice 'pg_cron indisponible : planifier la synchro sync-gel-avoirs autrement (cron externe / Scheduled Function).';
  end if;
end $$;
