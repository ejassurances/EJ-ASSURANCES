-- P0 security foundation: idempotency for public borrower intake.
-- The public endpoint uses service-role writes, so repeated submissions must be
-- safely replayable when the caller provides an Idempotency-Key.

create table if not exists public.public_intake_idempotency (
  endpoint text not null,
  idempotency_key text not null,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (endpoint, idempotency_key)
);

alter table public.public_intake_idempotency enable row level security;

revoke all on public.public_intake_idempotency from anon, authenticated;

create index if not exists public_intake_idempotency_created_at_idx
  on public.public_intake_idempotency(created_at);

-- Retention helper: service-role/server code may delete old keys during maintenance.
grant select, insert, update, delete on public.public_intake_idempotency to service_role;
