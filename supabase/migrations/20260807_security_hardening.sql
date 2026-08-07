-- Durcissement sécurité (advisor Supabase) — idempotent.
--   1. Policies RLS sur 5 tables « RLS activée sans policy » (deny-all → staff-only).
--   2. Révocation de l'EXECUTE public sur des fonctions SECURITY DEFINER exposées via RPC.
--   3. Fixation du search_path sur les fonctions SECURITY DEFINER à search_path mutable.
--
-- Rappel : ces tables n'ont AUCUNE policy en base (RLS active = tout est refusé sauf
-- service_role). Ajouter une policy staff-only est strictement additif (aucun accès
-- non-staff n'existait auparavant). app_private.is_staff() = rôle ∈ {admin, courtier}.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Policies RLS staff-only sur les 5 tables signalées.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['commissions','compliance_checks','email_logs','products','tasks']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "Staff manage %1$s" on public.%1$I;', t);
    execute format(
      'create policy "Staff manage %1$s" on public.%1$I for all to authenticated '
      || 'using (app_private.is_staff()) with check (app_private.is_staff());',
      t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Révoquer l'EXECUTE des rôles anon/authenticated sur les fonctions
--    SECURITY DEFINER appelables via /rest/v1/rpc.
--    Ce sont des fonctions de trigger / maintenance : elles n'ont pas besoin
--    d'être invocables directement par les clients de l'API.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.on_client_created_create_drive_folder()',
    'public.on_partner_created_create_drive_folder()',
    'public.on_partner_contract_created_create_drive_folder()',
    'public.on_project_created_create_drive_folder()',
    'public.rls_auto_enable()'
  ]
  loop
    -- to_regprocedure évite l'erreur si une fonction n'existe pas dans cet environnement.
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from anon, authenticated;', fn);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fixer search_path (= public, comme les autres fonctions app_private du schéma)
--    sur les fonctions SECURITY DEFINER à search_path mutable.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.on_client_created_create_drive_folder()',
    'public.on_partner_created_create_drive_folder()',
    'public.on_partner_contract_created_create_drive_folder()',
    'public.on_project_created_create_drive_folder()'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = public;', fn);
    end if;
  end loop;
end $$;
