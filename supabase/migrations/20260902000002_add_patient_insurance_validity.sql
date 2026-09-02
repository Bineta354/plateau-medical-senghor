-- Informations de couverture propres a chaque patient.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS assurance_numero TEXT,
  ADD COLUMN IF NOT EXISTS assurance_date_debut DATE,
  ADD COLUMN IF NOT EXISTS assurance_date_fin DATE;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_assurance_dates_valides;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_assurance_dates_valides
  CHECK (
    assurance_id IS NULL
    OR (
      assurance_date_fin IS NOT NULL
      AND (assurance_date_debut IS NULL OR assurance_date_fin >= assurance_date_debut)
    )
  );

COMMENT ON COLUMN public.patients.assurance_numero IS 'Numero d adhesion ou de police du patient';
COMMENT ON COLUMN public.patients.assurance_date_debut IS 'Debut de validite de la couverture du patient';
COMMENT ON COLUMN public.patients.assurance_date_fin IS 'Fin de validite de la couverture du patient';
