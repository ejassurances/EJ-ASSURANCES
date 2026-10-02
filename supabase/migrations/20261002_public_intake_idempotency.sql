-- P0 / Lot A: idempotence for public intake.
-- Service-role only: this table is an internal control, not client-facing data.

create table if not exists public.public_intake_idempotency (
  endpoint text not null,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  client_id uuid,
  project_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (endpoint, idempotency_key)
);

alter table public.public_intake_idempotency enable row level security;

revoke all on public.public_intake_idempotency from anon, authenticated;
grant select, insert, update, delete on public.public_intake_idempotency to service_role;

create index if not exists public_intake_idempotency_created_at_idx
  on public.public_intake_idempotency (created_at);
