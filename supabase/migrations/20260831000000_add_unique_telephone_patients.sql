-- Migration : Rendre le numéro de téléphone patient unique par cabinet (tenant)
-- Date: 2026-08-31
-- Description: Empêche la création de deux patients avec le même numéro de téléphone
-- au sein d'un même cabinet. Comme pour numero_secu/email (migration 20260805000000),
-- l'unicité est scoped par tenant_id et l'index est partiel (WHERE telephone IS NOT NULL)
-- pour ne pas bloquer les anciennes fiches sans téléphone renseigné.
--
-- La comparaison se fait sur les chiffres uniquement (regexp_replace(telephone, '\D', '', 'g'))
-- pour que "77 777 77 77" et "77777 7 77" (mêmes chiffres, espacement différent) soient bien
-- détectés comme le même numéro — le masque de saisie (src/utils/phone.js) produit
-- normalement toujours "77 777 77 77", mais les anciennes fiches peuvent avoir un format brut.
--
-- Vérifié le 2026-08-31 (avant migration) : aucun doublon de téléphone existant par tenant.

UPDATE public.patients SET telephone = NULL WHERE telephone = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_telephone
  ON public.patients (tenant_id, regexp_replace(telephone, '\D', '', 'g'))
  WHERE telephone IS NOT NULL;

COMMENT ON INDEX idx_patients_tenant_telephone IS
'Garantit l''unicité du téléphone (comparé chiffres uniquement) par tenant (NULL autorisé).';
