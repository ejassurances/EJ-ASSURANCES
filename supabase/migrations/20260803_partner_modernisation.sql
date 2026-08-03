-- Modernisation espace partenaire :
--   1. Assureur porteur par offre distribuée (grossiste multi-assureurs type UTWIN).
--   2. Téléversement réel des documents produit (CG / IPID / fiche produit) depuis le CRM.
--   3. Intégrations API multi-typologies par partenaire (une API peut couvrir plusieurs
--      typologies ; un partenaire peut avoir plusieurs API).

-- 1. Assureur porteur -------------------------------------------------------------
alter table public.partner_distributed_contracts
  add column if not exists insurer_name text;

-- 2. Stockage réel des documents produit ------------------------------------------
alter table public.partner_product_documents
  add column if not exists storage_path text,
  add column if not exists size_bytes bigint,
  add column if not exists mime_type text;

-- Bucket privé (lecture via URL signée générée par Server Action).
insert into storage.buckets (id, name, public)
values ('partner-documents', 'partner-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "partner-documents staff read" on storage.objects;
drop policy if exists "partner-documents staff manage" on storage.objects;
create policy "partner-documents staff read"
on storage.objects for select to authenticated
using (bucket_id = 'partner-documents' and app_private.is_staff());
create policy "partner-documents staff manage"
on storage.objects for all to authenticated
using (bucket_id = 'partner-documents' and app_private.is_staff())
with check (bucket_id = 'partner-documents' and app_private.is_staff());

-- 3. Intégrations API -------------------------------------------------------------
create table if not exists public.partner_api_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_companies(id) on delete cascade,
  name text not null,
  -- Typologies couvertes par cette API (une API peut en couvrir plusieurs).
  typologies text[] not null default '{}'::text[],
  protocol text not null default 'rest' check (protocol in ('rest', 'soap')),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production', 'unknown')),
  base_url text,
  wsdl_url text,
  -- REST : endpoints nommés ; SOAP : opérations.
  operations text[] not null default '{}'::text[],
  endpoints jsonb not null default '{}'::jsonb,
  auth_mode text not null default 'none'
    check (auth_mode in ('none', 'user_password', 'api_key', 'oauth2', 'basic', 'mtls', 'other')),
  login_identifier text,          -- login / code courtier (jamais le secret)
  secret_env_var text,            -- nom de la variable d'environnement contenant le secret
  status text not null default 'not_configured'
    check (status in ('not_configured', 'requested', 'sandbox_ready', 'production_ready', 'disabled', 'error')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_api_integrations_partner_idx
  on public.partner_api_integrations (partner_id);

alter table public.partner_api_integrations enable row level security;

drop policy if exists "partner_api_integrations staff all" on public.partner_api_integrations;
create policy "partner_api_integrations staff all"
on public.partner_api_integrations for all
to authenticated
using (app_private.is_staff())
with check (app_private.is_staff());
