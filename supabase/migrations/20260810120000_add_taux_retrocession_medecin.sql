-- Ajoute le taux de rétrocession médecin (paramètre par cabinet) : pourcentage du chiffre
-- d'affaires encaissé qui revient au médecin, le reste revenant au cabinet. Utilisé par le
-- Récapitulatif pour répartir les revenus encaissés par médecin entre part médecin / part cabinet.
-- NULL = non configuré : aucune répartition n'est calculée tant que le cabinet n'a pas renseigné
-- ce taux dans Paramètres du cabinet (mieux vaut ne rien afficher qu'un chiffre inventé).

ALTER TABLE public.parametres_cabinet
  ADD COLUMN IF NOT EXISTS taux_retrocession_medecin NUMERIC(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parametres_cabinet_taux_retrocession_medecin_check'
  ) THEN
    ALTER TABLE public.parametres_cabinet
      ADD CONSTRAINT parametres_cabinet_taux_retrocession_medecin_check
      CHECK (taux_retrocession_medecin IS NULL OR (taux_retrocession_medecin >= 0 AND taux_retrocession_medecin <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.parametres_cabinet.taux_retrocession_medecin IS
  'Pourcentage du chiffre d''affaires encaissé reversé au médecin (le reste va au cabinet). NULL = non configuré.';
