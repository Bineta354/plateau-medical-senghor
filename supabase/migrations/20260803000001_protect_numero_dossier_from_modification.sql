-- Migration : Protéger le champ numero_dossier contre toute modification
-- Date: 2026-08-03
-- Description: Le numéro de dossier est généré automatiquement et ne doit jamais être modifié.
-- Ce trigger empêche toute tentative de modification du champ numero_dossier après la création du patient.

-- Créer une fonction pour vérifier et rejeter la modification de numero_dossier
CREATE OR REPLACE FUNCTION prevent_numero_dossier_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si numero_dossier est en train d'être modifié (valeur différente de l'originale)
  IF OLD.numero_dossier IS DISTINCT FROM NEW.numero_dossier THEN
    RAISE EXCEPTION 'Désolé, il est impossible de modifier le numéro de dossier.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger BEFORE UPDATE sur la table patients
DROP TRIGGER IF EXISTS tr_prevent_numero_dossier_modification ON public.patients;

CREATE TRIGGER tr_prevent_numero_dossier_modification
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION prevent_numero_dossier_modification();

-- Ajouter un commentaire pour documentation
COMMENT ON FUNCTION prevent_numero_dossier_modification() IS 
'Fonction qui empêche la modification du champ numero_dossier après la création du patient. 
Le numéro de dossier est généré automatiquement et doit rester unique pour garantir la traçabilité.';

COMMENT ON TRIGGER tr_prevent_numero_dossier_modification ON public.patients IS 
'Trigger qui empêche toute modification du champ numero_dossier après la création du patient.
Déclenche une exception si une tentative de modification est détectée.';
