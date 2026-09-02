import { validatePatientAssurance } from '../../schemas/patientSchema';

describe('validation de couverture patient', () => {
  test('autorise un patient sans assurance', () => {
    expect(validatePatientAssurance({ assurance_id: null })).toBeNull();
  });

  test('exige une date de fin avec une assurance', () => {
    expect(validatePatientAssurance({ assurance_id: 1, assurance_date_fin: '' })).toBe('La date de fin de couverture est obligatoire.');
  });

  test('refuse une fin antérieure au début', () => {
    expect(validatePatientAssurance({ assurance_id: 1, assurance_date_debut: '2026-12-31', assurance_date_fin: '2026-01-01' })).toBe('La date de fin de couverture doit être supérieure ou égale à la date de début.');
  });
});
