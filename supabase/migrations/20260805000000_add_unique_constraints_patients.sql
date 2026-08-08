-- Migration : Rendre uniques les champs critiques d'identification patient
-- Date: 2026-08-05
-- Description: Empêche la création de doublons pour numero_secu et email.
-- L'unicité est scoped par tenant_id (comme idx_patients_tenant_numero_dossier) puisque
-- l'application est multi-tenant. Les index sont partiels (WHERE ... IS NOT NULL) car ces
-- champs restent optionnels à la création du dossier patient.
-- L'email est comparé en minuscules (lower()) pour éviter les doublons de casse
-- (ex: "Patient@mail.com" vs "patient@mail.com").
--
-- numero_ipm est volontairement EXCLU de l'unicité : ce numéro (assurance) est souvent
-- partagé entre plusieurs membres d'une même famille sous une seule police, ce n'est donc
-- pas un identifiant unique par patient.
--
-- Cette migration a déjà été appliquée manuellement en production le 2026-08-05 (via MCP
-- Supabase, projet senecare/zddaandjckkbidudduum) après nettoyage des données :
--   1. Des '' (chaîne vide) enregistrées au lieu de NULL par les anciens formulaires
--      généraient de faux doublons ('' IS NOT NULL est vrai en Postgres) -> corrigé par les
--      UPDATE ci-dessous. Le code applicatif ne réécrit plus jamais '' à la place de NULL,
--      voir normalizePatientPayload dans src/schemas/patientSchema.js.
--   2. 13 fiches avaient un email en doublon avec une autre fiche du même patient (même
--      nom saisi plusieurs fois) ou un email générique partagé par plusieurs patients
--      (coumba@gmail.com) -> email mis à NULL sur les fiches en trop (la plus ancienne de
--      chaque groupe est conservée), sans fusion ni suppression de dossier médical.
-- Ce fichier est conservé pour permettre de rejouer la migration sur un autre environnement
-- (ex: cabinet-ngor) après une vérification/nettoyage équivalente des doublons locaux.

UPDATE public.patients SET numero_secu = NULL WHERE numero_secu = '';
UPDATE public.patients SET numero_ipm = NULL WHERE numero_ipm = '';
UPDATE public.patients SET email = NULL WHERE email = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_numero_secu
  ON public.patients (tenant_id, numero_secu)
  WHERE numero_secu IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_email
  ON public.patients (tenant_id, lower(email))
  WHERE email IS NOT NULL;

COMMENT ON INDEX idx_patients_tenant_numero_secu IS
'Garantit l''unicité du numéro de sécurité sociale par tenant (NULL autorisé).';

COMMENT ON INDEX idx_patients_tenant_email IS
'Garantit l''unicité de l''email (insensible à la casse) par tenant (NULL autorisé).';
