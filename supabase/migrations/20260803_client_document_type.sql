-- Type de pièce (KYC) pour les documents client, et lien avec les exigences projet.
--   - doc_type : clé du type de document (ex. 'identity', 'proof_of_address', 'rib'…).
--     Pour les pièces déposées dans un projet, doc_type reprend la clé de l'exigence
--     (project_document_requirements.document_key) afin de la marquer « reçue ».
--   - Les documents KYC (client) restent distincts des documents Compagnies / Produits,
--     qui sont gérés dans l'espace Partenaires (partner_product_documents).

alter table public.client_documents add column if not exists doc_type text;

create index if not exists client_documents_doc_type_idx
  on public.client_documents (client_id, doc_type);
