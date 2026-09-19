-- Liste du personnel actif d'un cabinet pour l'ecran "Connectez-vous en tant que..."
-- (CabinetWelcome), affiche avec la cle publique avant le second login.
--
-- Remplace la lecture directe de public.users par le role anonyme (politique
-- public_read_active_users, supprimee) : la fonction n'expose que les colonnes
-- necessaires a l'ecran (ni e-mail, ni telephone) pour un cabinet donne.

CREATE OR REPLACE FUNCTION public.get_cabinet_staff(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'nom', u.nom,
        'prenom', u.prenom,
        'role', u.role,
        'photo_url', u.photo_url
      ) ORDER BY u.role
    ),
    '[]'::jsonb
  )
  FROM public.users u
  WHERE u.tenant_id = p_tenant_id
    AND COALESCE(u.actif, true);
$$;

REVOKE ALL ON FUNCTION public.get_cabinet_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cabinet_staff(uuid) TO anon, authenticated;
