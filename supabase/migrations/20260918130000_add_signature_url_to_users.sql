-- La page Parametres du medecin (doctor/SettingsPage.jsx) enregistre la signature
-- dans users.signature_url, et les ordonnances / factures imprimees la relisent
-- (ordonnancePrint.js, facturePrint.js). La colonne n'existait pas en prod :
-- la requete echouait avec 42703 "column users.signature_url does not exist".
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN public.users.signature_url IS 'URL publique de la signature manuscrite du medecin (bucket Storage signatures)';
