import { validateAssuranceDates } from '../../services/assuranceService';

jest.mock('../../lib/supabase', () => ({
  supabase: {},
}));

describe('validateAssuranceDates', () => {
  test('accepte une assurance avec une date de fin valide', () => {
    expect(validateAssuranceDates({ date_debut: '2026-01-01', date_fin: '2026-12-31' })).toBeNull();
  });

  test('rejette une assurance sans date de fin', () => {
    expect(validateAssuranceDates({ date_debut: '2026-01-01', date_fin: '' })).toBe('La date de fin d’assurance est obligatoire.');
  });

  test('rejette une date de fin antérieure à la date de début', () => {
    expect(validateAssuranceDates({ date_debut: '2026-12-31', date_fin: '2026-01-01' })).toBe('La date de fin doit être supérieure ou égale à la date de début.');
  });
});
