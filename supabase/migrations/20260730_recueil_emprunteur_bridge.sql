-- Pont recueil des besoins → pipeline Assurance Emprunteur dédié.
--   Objectif : quand un recueil des besoins déclare un projet d'assurance emprunteur,
--   il alimente désormais aussi le pipeline dédié (emprunteur_dossiers / emprunteur_credits)
--   en plus de borrower_insurance_requests, pour que le projet remonte dans /admin/emprunteur
--   et sur la fiche client.

-- 1. Origine du dossier : distinguer un dossier issu du tunnel public d'un dossier
--    créé depuis le recueil des besoins (adapte le libellé côté fiche client).
alter table public.emprunteur_dossiers
  add column if not exists source text not null default 'tunnel'
    check (source in ('tunnel', 'recueil'));

-- 2. Traçabilité + idempotence : un crédit créé depuis le recueil est rattaché à
--    l'assessment source, ce qui permet de le retrouver / le mettre à jour sans doublon.
alter table public.emprunteur_credits
  add column if not exists source_assessment_id uuid
    references public.needs_assessments(id) on delete set null;

create index if not exists idx_emprunteur_credits_source_assessment
  on public.emprunteur_credits (source_assessment_id);
