-- Notifications email FILTRÉES vers le courtier, via l'Edge Function send-email.
--   Uniquement 4 cas (tout le reste reste tracé en base, SANS email) :
--     1. Remplacement/modification d'un document client majeur (RIB, CNI, carte grise, contrat)
--     2. Alerte anti-fraude / anomalie KYC-DDA (compliance_checks)
--     3. Réclamation client (insertion dans reclamations)
--     4. Action nécessitant validation/arbitrage humain (tâche haute priorité)
--   Destinataire : erwan.jaffrelot@ej-assurances.fr
--   Contenu : nom client, nature de l'action (ancien/nouveau document si applicable),
--             lien direct vers le dossier Drive du client.

-- ─────────────────────────────────────────────────────────────────────────────
-- Fonction centrale : envoie l'alerte staff via send-email (pg_net).
--   La clé service role est lue depuis Vault (jamais en dur ; repo public).
--   ⚠️ Pré-requis (une fois) : select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   Sans le secret : aucun email (warning), mais JAMAIS de blocage de l'opération.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_staff(
  p_client_id uuid,
  p_nature text,
  p_ancien text default null,
  p_nouveau text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text;
begin
  begin
    select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  exception when others then
    service_key := null;
  end;

  if service_key is null then
    raise warning 'notify_staff: secret Vault "service_role_key" absent, email non envoyé (client %, %)', p_client_id, p_nature;
    return;
  end if;

  perform net.http_post(
    url     := 'https://huneukcmqaftwhidyegi.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body    := jsonb_build_object(
      'type', 'staff_alert',
      'to', 'erwan.jaffrelot@ej-assurances.fr',
      'client_id', p_client_id,
      'data', jsonb_build_object('nature', p_nature, 'ancien_document', p_ancien, 'nouveau_document', p_nouveau)
    )
  );
end;
$$;

-- Documents « majeurs » — LISTE FERMÉE (valeurs réellement utilisées, cf. code :
-- KYC_DOCUMENT_TYPES + document_key des exigences projet). Match exact (insensible
-- à la casse), pas de mots-clés.
--   rib                            → RIB / IBAN
--   identity                       → CNI / passeport (pièce d'identité)
--   current_insurance_certificate  → Contrat / notice assurance actuelle
--   carte_grise                    → Carte grise (⚠️ non présente à ce jour dans le
--                                     schéma/code ; incluse par anticipation).
create or replace function public.is_major_doc_type(t text) returns boolean
language sql immutable
as $$
  select t is not null and lower(t) = any (array[
    'rib',
    'identity',
    'current_insurance_certificate',
    'carte_grise'
  ]);
$$;

-- ── Cas 1a : documents (document_type) ───────────────────────────────────────
create or replace function public.trg_notify_document_major() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null or not public.is_major_doc_type(new.document_type) then return new; end if;
  if tg_op = 'UPDATE' then
    if new.storage_path is not distinct from old.storage_path
       and new.document_type is not distinct from old.document_type then
      return new; -- rien de significatif n'a changé
    end if;
    perform public.notify_staff(new.client_id,
      'Document majeur modifié/remplacé (' || new.document_type || ')', old.storage_path, new.storage_path);
  else
    perform public.notify_staff(new.client_id,
      'Nouveau document majeur (' || new.document_type || ')', null, new.storage_path);
  end if;
  return new;
end; $$;

drop trigger if exists trg_documents_notify on public.documents;
create trigger trg_documents_notify after insert or update on public.documents
  for each row execute function public.trg_notify_document_major();

-- ── Cas 1b : client_documents (doc_type / label / file_name) ─────────────────
create or replace function public.trg_notify_client_document_major() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Liste fermée : on ne se fie qu'au doc_type (les rows sans doc_type ne déclenchent pas).
  if not public.is_major_doc_type(new.doc_type) then return new; end if;
  if tg_op = 'UPDATE' then
    if new.storage_path is not distinct from old.storage_path
       and coalesce(new.doc_type, '') is not distinct from coalesce(old.doc_type, '') then
      return new;
    end if;
    perform public.notify_staff(new.client_id,
      'Document majeur modifié/remplacé (' || new.doc_type || ')',
      old.file_name, new.file_name);
  else
    perform public.notify_staff(new.client_id,
      'Nouveau document majeur (' || new.doc_type || ')',
      null, new.file_name);
  end if;
  return new;
end; $$;

drop trigger if exists trg_client_documents_notify on public.client_documents;
create trigger trg_client_documents_notify after insert or update on public.client_documents
  for each row execute function public.trg_notify_client_document_major();

-- ── Cas 2 : anomalie KYC-DDA / anti-fraude (compliance_checks) ───────────────
create or replace function public.trg_notify_compliance_anomaly() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  anomaly boolean;
begin
  if new.client_id is null then return new; end if;
  anomaly :=
       coalesce((new.result->>'match')::boolean, false)
    or (new.result->>'action') = 'freeze'
    or coalesce((new.result->>'isPPE')::boolean, false)
    or coalesce((new.result->>'isGelDesAvoirs')::boolean, false)
    or (new.result->>'decision') in ('confirmed_match', 'potential_match', 'review');
  if anomaly then
    perform public.notify_staff(new.client_id,
      'Alerte anti-fraude / anomalie KYC-DDA (' || coalesce(new.type, 'controle') || ')', null, null);
  end if;
  return new;
end; $$;

drop trigger if exists trg_compliance_notify on public.compliance_checks;
create trigger trg_compliance_notify after insert on public.compliance_checks
  for each row execute function public.trg_notify_compliance_anomaly();

-- ── Cas 3 : réclamation client (dès l'insertion) ─────────────────────────────
create or replace function public.trg_notify_reclamation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff(new.client_id,
    'Réclamation client' || coalesce(' — ' || new.nature, ''), null, null);
  return new;
end; $$;

drop trigger if exists trg_reclamations_notify on public.reclamations;
create trigger trg_reclamations_notify after insert on public.reclamations
  for each row execute function public.trg_notify_reclamation();

-- ── Cas 4 : action nécessitant validation/arbitrage humain (tâche haute prio) ─
--   Exclut les tâches déjà couvertes par l'alerte compliance (gel/PPE/KYC) pour
--   éviter un doublon d'email.
create or replace function public.trg_notify_task_arbitrage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null
     and new.priority = 'haute'
     and coalesce(new.title, '') !~* '(gel des avoirs|ppe|kyc)' then
    perform public.notify_staff(new.client_id,
      'Action nécessitant validation/arbitrage humain — ' || coalesce(new.title, ''), null, null);
  end if;
  return new;
end; $$;

drop trigger if exists trg_tasks_notify on public.tasks;
create trigger trg_tasks_notify after insert on public.tasks
  for each row execute function public.trg_notify_task_arbitrage();
