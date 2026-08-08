-- Registre réclamations & sinistres + RC Pro mandataires.
--   Tables staff-only (app_private.is_staff() = admin/courtier), même convention
--   que la migration de durcissement précédente. Idempotent.
--
-- Note statut : on suit la convention récente du repo (text + CHECK) plutôt que
-- des types enum natifs — plus souple à faire évoluer (pas de ALTER TYPE ADD VALUE).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Réclamations (suivi des délais réglementaires ACPR : AR sous 10 jours,
--    réponse sous 2 mois). Les délais limites sont des colonnes CALCULÉES.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reclamations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  nature text,
  date_reception timestamptz not null default now(),
  -- Délais limites CALCULÉS par trigger (voir set_reclamation_delais ci-dessous).
  -- Pas de colonne GENERATED : `timestamptz + interval` est STABLE (dépend du
  -- fuseau) et serait refusé dans une expression de génération (non IMMUTABLE).
  delai_accuse_reception timestamptz, -- = date_reception + 10 jours
  date_accuse_reception timestamptz,
  delai_reponse timestamptz,          -- = date_reception + 2 mois
  date_reponse timestamptz,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'en_cours', 'cloturee')),
  created_at timestamptz not null default now()
);

create index if not exists reclamations_client_idx on public.reclamations (client_id);
create index if not exists reclamations_statut_idx on public.reclamations (statut);

-- Calcule les délais réglementaires à partir de date_reception (à l'insertion et
-- à chaque modification de date_reception).
create or replace function public.set_reclamation_delais()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.delai_accuse_reception := new.date_reception + interval '10 days';
  new.delai_reponse := new.date_reception + interval '2 months';
  return new;
end;
$$;

drop trigger if exists trg_reclamation_delais on public.reclamations;
create trigger trg_reclamation_delais
  before insert or update of date_reception on public.reclamations
  for each row execute function public.set_reclamation_delais();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sinistres.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sinistres (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  nature text,
  date_declaration timestamptz not null default now(),
  assureur text,
  montant numeric(12, 2),
  statut text not null default 'declare' check (statut in ('declare', 'en_cours', 'cloture')),
  created_at timestamptz not null default now()
);

create index if not exists sinistres_client_idx on public.sinistres (client_id);
create index if not exists sinistres_statut_idx on public.sinistres (statut);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS staff-only sur les deux tables.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reclamations enable row level security;
alter table public.sinistres enable row level security;

drop policy if exists "Staff manage reclamations" on public.reclamations;
create policy "Staff manage reclamations" on public.reclamations for all to authenticated
  using (app_private.is_staff()) with check (app_private.is_staff());

drop policy if exists "Staff manage sinistres" on public.sinistres;
create policy "Staff manage sinistres" on public.sinistres for all to authenticated
  using (app_private.is_staff()) with check (app_private.is_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RC Pro des mandataires (obligation ORIAS / suivi d'échéance).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.mandataires
  add column if not exists rcpro_numero text,
  add column if not exists rcpro_assureur text,
  add column if not exists rcpro_date_echeance date;
