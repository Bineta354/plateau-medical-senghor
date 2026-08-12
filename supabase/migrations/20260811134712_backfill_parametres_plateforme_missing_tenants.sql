-- Suite de la migration précédente : l'ALTER TABLE ... ADD COLUMN tenant_id
-- DEFAULT effective_tenant_id() a été exécuté hors contexte utilisateur
-- (auth.uid() IS NULL), donc effective_tenant_id() est retombée sur
-- default_tenant_id() pour la ligne existante au lieu de rester NULL comme
-- prévu — la ligne de backfill conditionnelle (WHERE tenant_id IS NULL) de
-- la migration précédente n'a donc rien fait pour les 2 autres tenants
-- réels. On complète ici : un enregistrement par tenant restant, dupliqué
-- depuis la config actuelle.

INSERT INTO public.parametres_plateforme (configuration, tenant_id, client_id)
SELECT p.configuration, t.id, p.client_id
FROM public.tenants t
CROSS JOIN LATERAL (
  SELECT configuration, client_id FROM public.parametres_plateforme LIMIT 1
) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.parametres_plateforme p2 WHERE p2.tenant_id = t.id
);
