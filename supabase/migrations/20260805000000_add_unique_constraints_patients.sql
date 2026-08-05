-- Migration : Rendre uniques les champs critiques d'identification patient
-- Date: 2026-08-05
-- Description: Empêche la création de doublons pour numero_secu, numero_ipm et email.
-- L'unicité est scoped par tenant_id (comme idx_patients_tenant_numero_dossier) puisque
-- l'application est multi-tenant. Les index sont partiels (WHERE ... IS NOT NULL) car ces
-- champs restent optionnels à la création du dossier patient.
-- L'email est comparé en minuscules (lower()) pour éviter les doublons de casse
-- (ex: "Patient@mail.com" vs "patient@mail.com").

-- Avant d'exécuter cette migration en prod, vérifier qu'aucun doublon n'existe déjà :
--   SELECT tenant_id, numero_secu, count(*) FROM public.patients
--     WHERE numero_secu IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
--   SELECT tenant_id, numero_ipm, count(*) FROM public.patients
--     WHERE numero_ipm IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
--   SELECT tenant_id, lower(email), count(*) FROM public.patients
--     WHERE email IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
-- S'il existe des doublons, il faut les corriger (fusion de dossiers ou correction de
-- saisie) avant que ces index puissent être créés.
--
-- IMPORTANT (vérifié le 2026-08-05 sur les données actuelles) : les requêtes ci-dessus
-- remontent surtout des faux positifs car les formulaires patient enregistraient ''
-- (chaîne vide) au lieu de NULL pour ces champs quand ils étaient laissés vides — or ''
-- n'est pas NULL, donc tous les patients sans numéro/email entraient en collision. L'UPDATE
-- ci-dessous corrige ces valeurs avant la création des index (le code applicatif a aussi
-- été corrigé pour ne plus jamais réécrire '' à la place de NULL, voir normalizePatientPayload
-- dans src/schemas/patientSchema.js).
--
-- Une fois ce nettoyage fait, il restait de VRAIS doublons à corriger manuellement avant de
-- pouvoir appliquer cette migration (fiches à fusionner ou données à corriger) :
--   - numero_ipm '99-4571' (3 patients), '4856' (2 patients) sur le tenant d1d62ea1-...
--   - email en doublon (ex: mêmes prénom/nom saisis deux fois avec le même email) sur
--     plusieurs tenants — voir la requête de vérification ci-dessus après le nettoyage.

UPDATE public.patients SET numero_secu = NULL WHERE numero_secu = '';
UPDATE public.patients SET numero_ipm = NULL WHERE numero_ipm = '';
UPDATE public.patients SET email = NULL WHERE email = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_numero_secu
  ON public.patients (tenant_id, numero_secu)
  WHERE numero_secu IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_numero_ipm
  ON public.patients (tenant_id, numero_ipm)
  WHERE numero_ipm IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_email
  ON public.patients (tenant_id, lower(email))
  WHERE email IS NOT NULL;

COMMENT ON INDEX idx_patients_tenant_numero_secu IS
'Garantit l''unicité du numéro de sécurité sociale par tenant (NULL autorisé).';

COMMENT ON INDEX idx_patients_tenant_numero_ipm IS
'Garantit l''unicité du numéro IPM par tenant (NULL autorisé).';

COMMENT ON INDEX idx_patients_tenant_email IS
'Garantit l''unicité de l''email (insensible à la casse) par tenant (NULL autorisé).';
