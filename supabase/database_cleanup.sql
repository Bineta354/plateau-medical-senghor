-- NETTOYAGE URGENT DE LA BASE DE DONNÉES
-- Exécuter ces requêtes pour réinitialiser les statuts corrompus

-- NETTOYAGE DES PATIENTS 'AUTHORIZED' ANCIENS (plus de 1 heure)
UPDATE waiting_queue 
SET status = 'waiting' 
WHERE status = 'authorized' 
AND updated_at < NOW() - INTERVAL '1 hour';

-- NETTOYAGE DU PATIENT 81 (MÉDECIN 55) BLOQUÉ PAR LE TRIGGER
-- ÉTAPE 1: Voir l'état actuel de ce patient
SELECT id, patient_id, medecin_id, status, created_at, updated_at 
FROM waiting_queue 
WHERE patient_id = 81 AND medecin_id = 55;

-- ÉTAPE 2A: Si statut = 'authorized' depuis plus d'1h → marquer comme 'absent'
UPDATE waiting_queue 
SET status = 'absent',
    updated_at = NOW()
WHERE patient_id = 81 
  AND medecin_id = 55 
  AND status = 'authorized'
  AND updated_at < NOW() - INTERVAL '1 hour';

-- ÉTAPE 2B: Si c'est une donnée de test → supprimer
-- DELETE FROM waiting_queue 
-- WHERE patient_id = 81 AND medecin_id = 55;

-- OPTION 1: Réinitialiser tous les patients avec statut 'authorized' à 'waiting'
UPDATE waiting_queue
SET status = 'waiting',
    updated_at = NOW()
WHERE status = 'authorized';

-- OPTION 2: Réinitialiser tous les patients avec statut 'en_route' à 'waiting'
UPDATE waiting_queue
SET status = 'waiting',
    updated_at = NOW()
WHERE status = 'en_route';

-- OPTION 3: Réinitialiser tous les patients sauf ceux en consultation
UPDATE waiting_queue
SET status = 'waiting',
    updated_at = NOW()
WHERE status NOT IN ('in_consultation', 'waiting');

-- OPTION 4: Supprimer les patients de test (adapter les noms si nécessaire)
-- D'abord vérifier les patients à supprimer:
SELECT id, patient_nom, patient_prenom, status, medecin_id, created_at
FROM waiting_queue
WHERE patient_nom IN ('Dabo', 'Dalise', 'Diop')
ORDER BY created_at DESC;

-- Si ce sont bien des données de test, les supprimer:
-- DELETE FROM waiting_queue
-- WHERE patient_nom IN ('Dabo', 'Dalise', 'Diop');

-- OPTION 5: Réinitialiser spécifiquement les patients mentionnés
UPDATE waiting_queue
SET status = 'waiting',
    updated_at = NOW()
WHERE (patient_nom = 'Dabo' AND patient_prenom = 'Mamadou Lamine')
   OR (patient_nom = 'Dabo' AND patient_prenom = 'Rokhaya')
   OR (patient_nom = 'Dalise' AND patient_prenom = 'Aliane')
   OR (patient_nom = 'Diop' AND patient_prenom = 'Babou');

-- Vérifier le résultat après nettoyage
SELECT id, patient_nom, patient_prenom, status, medecin_id, updated_at
FROM waiting_queue
ORDER BY updated_at DESC
LIMIT 20;
