-- Ajoute la valeur 'sans_suite' à l'enum public.project_status.
--
-- IMPORTANT — bonne pratique Postgres :
--   ALTER TYPE ... ADD VALUE ne peut pas être suivi d'un usage de la nouvelle
--   valeur dans la MÊME transaction. Cette migration est donc VOLONTAIREMENT
--   isolée : elle ne fait qu'ajouter la valeur, aucune insertion/mise à jour ni
--   contrainte ne l'utilise ici. Tout code qui écrit 'sans_suite' doit passer
--   par une migration/transaction ultérieure.
--
--   'sans_suite' est une valeur DISTINCTE de 'closed' : dossier abandonné/sans
--   suite (≠ clôturé/signé). Ordre logique : ajoutée après 'closed'.

alter type public.project_status add value if not exists 'sans_suite';
