-- Pièces jointes des contrats / projets client, avec choix de visibilité client.
--   - Une pièce est rattachée à un contrat OU à un projet (au moins l'un des deux).
--   - visible_to_client : gouverne la visibilité côté client des pièces déposées
--     par le cabinet. Les pièces déposées par le client lui sont toujours visibles.
--   - Bucket privé : aucune URL publique, lecture uniquement via URL signée générée
--     par une Server Action après contrôle d'accès (même logique que prospect-documents).

-- 1. Bucket privé (idempotent).
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update set public = false;

-- 2. Table des pièces jointes.
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  label text,
  visible_to_client boolean not null default false,
  uploaded_by uuid,
  uploaded_by_role text not null default 'staff'
    check (uploaded_by_role in ('staff', 'mandataire', 'client')),
  created_at timestamptz not null default now(),
  -- Rattachement obligatoire à un contrat OU un projet.
  constraint client_documents_scope_chk check (contract_id is not null or project_id is not null)
);

create index if not exists client_documents_client_idx on public.client_documents (client_id);
create index if not exists client_documents_contract_idx on public.client_documents (contract_id);
create index if not exists client_documents_project_idx on public.client_documents (project_id);

alter table public.client_documents enable row level security;

-- 3. Politiques RLS (défense en profondeur ; les Server Actions contrôlent aussi l'accès).
drop policy if exists "client_documents staff all" on public.client_documents;
drop policy if exists "client_documents mandataire select" on public.client_documents;
drop policy if exists "client_documents mandataire insert" on public.client_documents;
drop policy if exists "client_documents mandataire delete" on public.client_documents;
drop policy if exists "client_documents client select" on public.client_documents;
drop policy if exists "client_documents client insert" on public.client_documents;
drop policy if exists "client_documents client delete" on public.client_documents;

-- 3a. Staff (admin / courtier) : accès complet.
create policy "client_documents staff all"
on public.client_documents for all
to authenticated
using (app_private.is_staff())
with check (app_private.is_staff());

-- 3b. Mandataire : gestion des pièces de ses clients rattachés.
create policy "client_documents mandataire select"
on public.client_documents for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    join public.mandataires m on m.id = c.mandataire_id
    where c.id = client_documents.client_id and m.profile_id = auth.uid()
  )
);
create policy "client_documents mandataire insert"
on public.client_documents for insert
to authenticated
with check (
  exists (
    select 1 from public.clients c
    join public.mandataires m on m.id = c.mandataire_id
    where c.id = client_documents.client_id and m.profile_id = auth.uid()
  )
);
create policy "client_documents mandataire delete"
on public.client_documents for delete
to authenticated
using (
  exists (
    select 1 from public.clients c
    join public.mandataires m on m.id = c.mandataire_id
    where c.id = client_documents.client_id and m.profile_id = auth.uid()
  )
);

-- 3c. Client : voit les pièces de son dossier qui lui sont destinées ou qu'il a lui-même
--     déposées ; peut déposer sur son dossier ; peut supprimer ses propres dépôts.
create policy "client_documents client select"
on public.client_documents for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_documents.client_id and c.profile_id = auth.uid()
  )
  and (visible_to_client or uploaded_by_role = 'client')
);
create policy "client_documents client insert"
on public.client_documents for insert
to authenticated
with check (
  uploaded_by_role = 'client'
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.clients c
    where c.id = client_documents.client_id and c.profile_id = auth.uid()
  )
);
create policy "client_documents client delete"
on public.client_documents for delete
to authenticated
using (
  uploaded_by = auth.uid()
  and uploaded_by_role = 'client'
  and exists (
    select 1 from public.clients c
    where c.id = client_documents.client_id and c.profile_id = auth.uid()
  )
);

-- 4. Politiques storage : le personnel peut lire/gérer les objets du bucket.
--    (Client & mandataire passent par les Server Actions + client de service ;
--     aucune policy storage ne leur est nécessaire.)
drop policy if exists "client-documents staff read" on storage.objects;
drop policy if exists "client-documents staff manage" on storage.objects;

create policy "client-documents staff read"
on storage.objects for select
to authenticated
using (bucket_id = 'client-documents' and app_private.is_staff());

create policy "client-documents staff manage"
on storage.objects for all
to authenticated
using (bucket_id = 'client-documents' and app_private.is_staff())
with check (bucket_id = 'client-documents' and app_private.is_staff());
