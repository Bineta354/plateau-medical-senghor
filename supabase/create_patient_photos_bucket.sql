-- Script SQL pour créer le bucket patient-photos (photo d'identité du patient)
-- ⚠️ ATTENTION: Ce script peut nécessiter des permissions élevées
-- Si vous obtenez une erreur de permissions, suivez les instructions ci-dessous
--
-- Utilisé par PatientDetailsPage.jsx (upload de la photo patient) et affiché
-- en lecture seule dans ConsultationDetail.jsx / FichePatientOnly.jsx via
-- patients.photo_url (colonne ajoutée par la migration
-- 20250102000003_phase1_rendez_vous.sql).

-- ============================================================================
-- MÉTHODE 1: Création via SQL (nécessite des permissions admin)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-photos',
  'patient-photos',
  true,  -- Bucket public pour permettre l'affichage direct de la photo
  5242880,  -- Limite de 5MB par fichier
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MÉTHODE 2: Création via l'interface Supabase (RECOMMANDÉ)
-- ============================================================================
--
-- Si le script SQL ci-dessus échoue avec une erreur de permissions,
-- suivez ces étapes pour créer le bucket via l'interface :
--
-- 1. Allez sur https://supabase.com et connectez-vous
-- 2. Ouvrez votre projet
-- 3. Allez dans "Storage" dans le menu de gauche
-- 4. Cliquez sur "New bucket"
-- 5. Configurez le bucket :
--    - Name: patient-photos
--    - Public bucket: ✅ Activé (cochez cette case)
--    - File size limit: 5 MB
--    - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp
-- 6. Cliquez sur "Create bucket"
--
-- Ensuite, exécutez le script ci-dessous pour créer les politiques RLS
-- (Ces politiques peuvent aussi être créées via l'interface Storage > Policies)

-- ============================================================================
-- POLITIQUES RLS (à exécuter APRÈS la création du bucket)
-- ============================================================================

DROP POLICY IF EXISTS "Public Access for patient-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to patient-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient-photos" ON storage.objects;

-- Lecture publique (nécessaire pour afficher la photo dans l'app sans signer d'URL)
CREATE POLICY "Public Access for patient-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-photos');

-- Upload réservé aux utilisateurs authentifiés (secrétaire/médecin/admin du cabinet)
CREATE POLICY "Authenticated users can upload to patient-photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'patient-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update patient-photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'patient-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete patient-photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'patient-photos'
  AND auth.role() = 'authenticated'
);
