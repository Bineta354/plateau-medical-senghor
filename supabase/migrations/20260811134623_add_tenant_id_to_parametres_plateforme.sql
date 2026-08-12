-- parametres_plateforme n'était pas cloisonnée par tenant : une seule ligne
-- globale (contrainte "un seul enregistrement" à la création de la table),
-- lue/écrite sans filtre tenant_id, et protégée par des policies RLS
-- "simple_*" USING (true) laissant n'importe quel utilisateur authentifié
-- lire ET modifier les couleurs/logo/modèles de documents de TOUS les
-- cabinets. Aligné ici sur le mécanisme tenant_id déjà en place sur
-- parametres_cabinet (current_tenant_id()/effective_tenant_id()), voir
-- 20260810142959_cleanup_parametres_cabinet_rls_policies.

ALTER TABLE public.parametres_plateforme
  ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT effective_tenant_id();

-- Un enregistrement par tenant, initialisé à partir de la config globale
-- existante pour ne pas réinitialiser l'apparence/les modèles de documents
-- déjà configurés.
INSERT INTO public.parametres_plateforme (configuration, tenant_id, client_id)
SELECT p.configuration, t.id, p.client_id
FROM public.parametres_plateforme p
CROSS JOIN public.tenants t
WHERE p.tenant_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.parametres_plateforme p2 WHERE p2.tenant_id = t.id
  );

-- Supprimer l'ancienne ligne orpheline (sans tenant_id) une fois dupliquée.
DELETE FROM public.parametres_plateforme WHERE tenant_id IS NULL;

-- Policies d'isolation par tenant, identiques au pattern parametres_cabinet.
CREATE POLICY "tenant_select_parametres_plateforme"
  ON public.parametres_plateforme FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_insert_parametres_plateforme"
  ON public.parametres_plateforme FOR INSERT
  WITH CHECK (tenant_id = effective_tenant_id());

CREATE POLICY "tenant_update_parametres_plateforme"
  ON public.parametres_plateforme FOR UPDATE
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = effective_tenant_id());

CREATE POLICY "tenant_delete_parametres_plateforme"
  ON public.parametres_plateforme FOR DELETE
  USING (tenant_id = current_tenant_id());

-- Retirer les anciennes policies dangereusement permissives (USING true) et
-- celle basée sur client_id (claim JWT jamais posé par l'app — le login ne
-- fixe que tenant_id via users.tenant_id).
DROP POLICY IF EXISTS "simple_read" ON public.parametres_plateforme;
DROP POLICY IF EXISTS "simple_insert" ON public.parametres_plateforme;
DROP POLICY IF EXISTS "simple_update" ON public.parametres_plateforme;
DROP POLICY IF EXISTS "simple_delete" ON public.parametres_plateforme;
DROP POLICY IF EXISTS "parametres_plateforme_client_access" ON public.parametres_plateforme;
