# 80 — Étude de faisabilité : devoir de conseil dynamique + signature électronique

> **Statut : ÉTUDE — aucun développement engagé.**
> Validation juridique **en attente côté Conformité** (valeur probante, niveau
> de signature eIDAS requis pour un devoir de conseil DDA). Ce document cadre la
> faisabilité technique ; il ne vaut pas décision d'architecture.

## 1. Objectif

Générer automatiquement le **devoir de conseil** (note de synthèse DDA) à partir
des données déjà saisies dans le CRM (recueil de besoins → devis → contrat
choisi), puis le faire **signer électroniquement** par le client, avec archivage
et valeur probante.

## 2. Existant réutilisable (ne pas repartir de zéro)

| Brique | État | Réutilisation |
|---|---|---|
| `needs_assessments` / `project_borrower_needs` | ✅ en base | Source des données « recueil » |
| Étape « Cotation / devis » (`partner_distributed_contracts`) | 🟡 partiel | Source « devis / comparatif » |
| `contracts` | 🟠 structure | Source « contrat retenu » |
| `project_deliveries` (`delivery_type` = `fiche_conseil`) | ✅ | Traçabilité de l'envoi |
| `project_signatures` (`status`: pending/signed/refused/expired) | ✅ | **Table pivot déjà prête pour la signature** |
| `lettres-mission` (génération + espace client) | ✅ | Précédent de doc généré + parcours client |
| Google Workspace (Drive/Gmail, refresh token) | ✅ | Stockage + envoi |
| Skill `docx` (côté Claude) | ✅ | Génération/édition de `.docx` |

**Conclusion** : le socle « générer un document + le faire signer + tracer » existe
déjà partiellement (`project_signatures`, `project_deliveries`, lettres-mission).
L'étude porte sur (a) le **mapping données→document** et (b) le **prestataire de
signature**.

## 3. (a) Mapping recueil / devis / contrat → document Word

### 3.1 Approche recommandée : modèle `.docx` à variables + moteur de fusion déterministe

- Un **modèle Word** (`.dotx`/`.docx`) balisé avec des variables (`{{client_nom}}`,
  `{{crd_date_effet}}`…), maintenu par le métier.
- Un **moteur de templating déterministe** côté serveur (type *docxtemplater* /
  remplacement de placeholders) fusionne les données CRM dans le modèle.
- ⚠️ **Ne pas** faire rédiger les valeurs chiffrées/juridiques par un LLM : la
  génération doit être **déterministe** (mêmes entrées → même document). Le skill
  `docx` côté Claude est adapté au **prototypage du modèle** et à la mise en forme,
  pas à la production des montants (cf. principe déjà appliqué à l'intake
  amortissement : l'IA extrait, l'app calcule).

### 3.2 Table de correspondance envisagée (extrait)

| Champ document | Source CRM | Table / champ |
|---|---|---|
| Identité client, coordonnées | Fiche client | `clients.full_name`, `email`, `adresse`… |
| Situation / besoins exprimés | Recueil | `needs_assessments` / `project_borrower_needs` |
| Objectif, exigences | Recueil | `project_borrower_needs.objective`, `requested_guarantees`, `requested_quotities` |
| Garanties comparées / devis | Cotation | `partner_distributed_contracts` (garanties, positionnement) |
| Contrat recommandé + justification | Choix | `contracts` + note de motivation |
| Capital restant dû / date d'effet (AE) | Calcul | `project_borrower_needs.remaining_capital`, projection CRD |
| Date, signataire, mentions DDA | Système | horodatage + `project_signatures` |

### 3.3 Points ouverts (métier/juridique)
- Modèle **unique et paramétrable** vs **plusieurs modèles par typologie**
  (emprunteur, prévoyance, santé…). Recommandation : un modèle par typologie,
  variables communes factorisées.
- Champs **obligatoires DDA** à figer avec la Conformité (mentions légales,
  justification de l'adéquation, alternatives écartées).

## 4. (b) Signature électronique — options

| Critère | Google Workspace eSignature | DocuSign | Yousign |
|---|---|---|---|
| Origine / hébergement | US (Google) | US (régions UE dispo) | **FR / UE** |
| Conformité eIDAS | Signature **simple (SES)** | SES / **AES** / QES | SES / **AES** / QES |
| Valeur probante (litige DDA) | Faible/moyenne | Élevée | Élevée |
| API / webhooks | **Limitée** (surtout UI Docs/Drive) | **Mature** (REST + webhooks) | **Mature** (REST + webhooks) |
| Intégration workflow CRM | Difficile (peu programmable) | Bonne | Bonne |
| Coût | Inclus Workspace (selon édition) | €€€ | €€ |
| Souveraineté / RGPD (courtier FR) | Moyenne | Moyenne | **Forte** |
| Écosystème assurance FR | Faible | Fort | **Fort** |

### Lecture
- **Google Workspace eSignature** : quasi « gratuit » (déjà dans Workspace) et
  simple, mais **signature simple**, **peu d'API** → mal adapté à un parcours CRM
  automatisé et à la valeur probante d'un devoir de conseil réglementé. Convient à
  un usage interne léger, pas au flux DDA.
- **DocuSign** : le plus mature/robuste, API excellente, mais coût élevé et acteur
  US.
- **Yousign** : acteur **français**, eIDAS (AES possible), hébergement UE, API +
  webhooks, très implanté en assurance/finance FR → **meilleur alignement** avec un
  cabinet ACPR/DDA, à coût maîtrisé.

### Recommandation technique (sous réserve Conformité)
Cibler un prestataire **API-first avec niveau AES** (Yousign en tête, DocuSign en
alternative), intégré via :
1. création d'une demande de signature (« enveloppe ») à la génération du devoir de
   conseil ;
2. suivi d'état via **webhook** → mise à jour de `project_signatures.status`
   (pending → signed/refused/expired) ;
3. récupération du document signé + preuve, archivage Drive (nomenclature existante).

Écarter Google eSignature pour ce cas d'usage (garder éventuellement pour des
signatures internes non réglementées).

## 5. Complexité d'intégration (qualitatif)

| Option | Effort d'intégration | Risque |
|---|---|---|
| Google eSignature | Faible en apparence, mais **plafonné** (peu d'API → workflow bricolé) | Élevé (valeur probante) |
| DocuSign | Moyen (SDK/API mûrs) | Faible technique / coût élevé |
| Yousign | Moyen (SDK/API mûrs, doc FR) | Faible |

Le moteur de **templating `.docx`** est un chantier distinct et modéré (choix du
moteur + balisage des modèles + tests de fusion), indépendant du prestataire de
signature.

## 6. Prochaines étapes (à ne PAS démarrer avant feu vert Conformité)
1. **Conformité** : figer le niveau de signature requis (SES vs AES) et les
   mentions DDA obligatoires. **← bloquant.**
2. Choix prestataire (Yousign / DocuSign) + POC API sur un modèle unique.
3. Spécifier le moteur de templating et baliser un premier modèle (emprunteur).
4. Brancher le webhook de signature sur `project_signatures`.

## 7. Réserve
Aucune de ces pistes n'est engagée. Ce document est une **étude de faisabilité** ;
la décision et tout développement sont **suspendus à la validation juridique
(Conformité)**.
