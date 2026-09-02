import { formatTelephoneSN, isValidTelephoneSN, normalizeTelephoneSN } from '../../utils/phone';

describe('telephone senegalais', () => {
  test('accepte un numero avec le prefixe +221', () => {
    expect(isValidTelephoneSN('+221 77 123 45 67')).toBe(true);
  });

  test('normalise le prefixe +221 en numero local', () => {
    expect(normalizeTelephoneSN('+221 77 123 45 67')).toBe('771234567');
    expect(formatTelephoneSN('+221 77 123 45 67')).toBe('77 123 45 67');
  });

  test('rejette un prefixe mobile senegalais invalide', () => {
    expect(isValidTelephoneSN('+221 33 123 45 67')).toBe(false);
  });
});
