-- Chargement dynamique des « system instructions » de ai-agent-gemini depuis Google Drive.
--   Une ligne par agent_key. Le contenu Drive chargé avec succès est mémorisé ici
--   et sert de repli (fallback) si Drive devient inaccessible / fichier supprimé /
--   contenu vide. La liste blanche des drive_file_id autorisés est codée en dur
--   dans la fonction (aucune découverte automatique de fichiers).
-- RLS staff-only (admin/courtier) ; écriture aussi par le service role (Edge Function).

create table if not exists public.agent_instructions (
  agent_key text primary key,           -- ex. 'ppe_screening', 'client_query'
  drive_file_id text,                   -- ID de fichier Drive fixe (dernier utilisé)
  content text,                         -- dernière version chargée avec succès (repli)
  content_hash text,                    -- SHA-256 du contenu (détection de changement)
  fetched_at timestamptz,               -- dernier chargement Drive réussi
  last_error text,                      -- dernier échec (message), pour journalisation
  last_attempt_at timestamptz,          -- dernier essai (succès ou échec)
  updated_at timestamptz not null default now()
);

alter table public.agent_instructions enable row level security;
drop policy if exists "Staff manage agent_instructions" on public.agent_instructions;
create policy "Staff manage agent_instructions" on public.agent_instructions for all to authenticated
  using (app_private.is_staff()) with check (app_private.is_staff());
