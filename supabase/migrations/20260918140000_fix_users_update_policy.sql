-- Corrige la politique UPDATE de public.users.
--
-- Probleme : la politique "Update own or admin cabinet users" testait
--   (role = 'admin' AND cabinet_id = get_my_cabinet_id())
-- sur la LIGNE MODIFIEE, pas sur l'utilisateur connecte. Consequences :
--   1) un admin ne pouvait pas modifier un medecin (la base ignorait la demande sans erreur) ;
--   2) n'importe quel utilisateur du cabinet pouvait modifier la fiche d'un admin
--      (elevation de privileges).
--
-- Apres correction : chacun modifie son propre profil (users_update_own_profile, inchangee)
-- et seuls les admins modifient les autres utilisateurs de LEUR PROPRE cabinet (tenant).

-- Fonction SECURITY DEFINER : evite toute recursion de politique en lisant users
-- avec les droits du proprietaire de la fonction.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_id = auth.uid()
      AND role = 'admin'
      AND COALESCE(actif, true)
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS "Update own or admin cabinet users" ON public.users;
DROP POLICY IF EXISTS users_update_tenant_admin ON public.users;

CREATE POLICY users_update_tenant_admin
ON public.users FOR UPDATE
TO authenticated
USING (
  public.current_user_is_admin()
  AND tenant_id = public.current_tenant_id()
)
WITH CHECK (
  -- un admin ne peut pas deplacer un utilisateur vers un autre cabinet
  tenant_id = public.current_tenant_id()
);
