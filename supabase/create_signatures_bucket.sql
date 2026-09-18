-- Bucket "signatures" : signature manuscrite des medecins (ordonnances, certificats).
-- Utilise par src/pages/doctor/SettingsPage.jsx, qui nomme chaque fichier
-- signature-<auth.uid()>-<horodatage>.png.
-- A executer dans l'editeur SQL Supabase APRES la migration
-- 20260918130000_add_signature_url_to_users.sql.
-- Si l'insertion dans storage.buckets echoue faute de droits, creer le bucket via
-- Storage > New bucket (nom: signatures, public, 2 Mo, image/png) puis executer
-- seulement la partie POLITIQUES ci-dessous.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true,            -- lecture publique : la signature est imprimee sur les documents
  2097152,         -- 2 Mo
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- POLITIQUES
-- Ecriture reservee au proprietaire du fichier : le nom doit commencer par
-- "signature-<son auth.uid()>-", ce qui empeche un utilisateur de remplacer ou
-- supprimer la signature d'un autre medecin.
-- ============================================================================

DROP POLICY IF EXISTS "Public read signatures" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload signature" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update signature" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete signature" ON storage.objects;

CREATE POLICY "Public read signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

CREATE POLICY "Owner can upload signature"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signatures'
  AND auth.role() = 'authenticated'
  AND name LIKE 'signature-' || auth.uid()::text || '-%'
);

CREATE POLICY "Owner can update signature"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'signatures'
  AND auth.role() = 'authenticated'
  AND name LIKE 'signature-' || auth.uid()::text || '-%'
);

CREATE POLICY "Owner can delete signature"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signatures'
  AND auth.role() = 'authenticated'
  AND name LIKE 'signature-' || auth.uid()::text || '-%'
);
