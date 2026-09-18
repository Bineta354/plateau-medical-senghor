-- La page Consultation (consultationService.getConsultation) et la fiche
-- patient (upload de photo, carte Allergies) attendent ces deux colonnes sur
-- patients, absentes en prod : provoquait un 42703 "column patients_1.allergies
-- does not exist" a chaque ouverture de consultation.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS photo_url CHARACTER VARYING;

COMMENT ON COLUMN public.patients.allergies IS 'Allergies connues du patient, saisies en texte libre';
COMMENT ON COLUMN public.patients.photo_url IS 'URL publique de la photo du patient (bucket Storage patient-photos)';
