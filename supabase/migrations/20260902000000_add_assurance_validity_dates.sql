-- Dates de validite des assurances.
-- Les colonnes restent nullable pour conserver les assurances historiques et les
-- completer progressivement depuis l'ecran de parametrage.
ALTER TABLE public.assurances
  ADD COLUMN IF NOT EXISTS date_debut DATE,
  ADD COLUMN IF NOT EXISTS date_fin DATE;

ALTER TABLE public.assurances
  DROP CONSTRAINT IF EXISTS assurances_dates_valides;

ALTER TABLE public.assurances
  ADD CONSTRAINT assurances_dates_valides
  CHECK (
    date_fin IS NULL
    OR (date_debut IS NOT NULL AND date_fin >= date_debut)
  );

COMMENT ON COLUMN public.assurances.date_debut IS 'Date de debut de validite de la couverture';
COMMENT ON COLUMN public.assurances.date_fin IS 'Date de fin de validite de la couverture';
