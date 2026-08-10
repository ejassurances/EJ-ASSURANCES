-- Brique 1 — statut de vérification des pièces déposées par le prospect.
--   La table public.documents n'avait pas de colonne de statut : on l'ajoute
--   (nullable, sans backfill) pour ne pas requalifier les documents existants.
--   Nouvelles pièces déposées via /api/prospect/upload-document :
--     'pending_verification' (🟡) → mis à 'received' (🟢) par le webhook Drive.
alter table public.documents
  add column if not exists status text;

-- Valeurs autorisées (idempotent : on rejoue proprement).
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status is null or status in ('pending_verification', 'received', 'validated', 'rejected'));

-- Filtre fréquent : pièces en attente de vérification.
create index if not exists idx_documents_status on public.documents (status);
