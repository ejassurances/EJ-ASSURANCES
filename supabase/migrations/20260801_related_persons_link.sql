-- Liaison d'une personne liée (membre de famille, co-assuré…) à une fiche client.
--   - linked_client_id : quand la personne correspond à un client existant du cabinet
--     (sélectionné) ou à une fiche nouvellement créée. Null si simple info.
--   - on delete set null : supprimer le client rattaché ne supprime pas la relation.

alter table public.related_persons
  add column if not exists linked_client_id uuid references public.clients(id) on delete set null;

create index if not exists related_persons_linked_client_idx
  on public.related_persons (linked_client_id);
