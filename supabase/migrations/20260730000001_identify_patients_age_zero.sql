-- Migration: Identifier les patients avec âge = 0 an ou moins
-- Date: 2026-07-30
-- Description: Cette requête permet d'identifier tous les patients dont la date de naissance
-- donne un âge de 0 an ou moins (date de naissance dans le futur ou date d'il y a moins d'1 an)

-- Requête pour identifier les patients avec âge = 0 an ou moins
SELECT 
  id,
  nom,
  prenom,
  date_naissance,
  numero_dossier,
  telephone,
  email,
  actif,
  created_at,
  -- Calcul de l'âge
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) as age_annees,
  EXTRACT(MONTH FROM AGE(CURRENT_DATE, date_naissance)) as age_mois,
  EXTRACT(DAY FROM AGE(CURRENT_DATE, date_naissance)) as age_jours
FROM patients
WHERE 
  date_naissance IS NULL 
  OR date_naissance > CURRENT_DATE 
  OR date_naissance > CURRENT_DATE - INTERVAL '1 year'
ORDER BY date_naissance DESC NULLS LAST;

-- Pour corriger manuellement ces patients, vous pouvez utiliser la requête UPDATE suivante :
-- UPDATE patients SET date_naissance = 'YYYY-MM-DD' WHERE id = XXX;
-- Remplacez 'YYYY-MM-DD' par la date correcte et XXX par l'ID du patient
