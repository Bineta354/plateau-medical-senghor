import { computeStatutPaiement, isOutstanding } from '../../utils/factureStatus';

describe('computeStatutPaiement', () => {
  test('retourne en_attente si rien n\'a été payé', () => {
    expect(computeStatutPaiement(0, 10000)).toBe('en_attente');
  });

  test('retourne partiel si le montant payé est inférieur au total', () => {
    expect(computeStatutPaiement(4000, 10000)).toBe('partiel');
  });

  test('retourne paye si le montant payé est exactement égal au total', () => {
    expect(computeStatutPaiement(10000, 10000)).toBe('paye');
  });

  test('retourne paye si le montant payé dépasse le total (trop-perçu)', () => {
    expect(computeStatutPaiement(10500, 10000)).toBe('paye');
  });

  test('gère les valeurs non numériques comme 0', () => {
    expect(computeStatutPaiement(undefined, 10000)).toBe('en_attente');
  });
});

describe('isOutstanding', () => {
  test('en_attente et partiel sont outstanding', () => {
    expect(isOutstanding('en_attente')).toBe(true);
    expect(isOutstanding('partiel')).toBe(true);
  });

  test('paye et impaye ne sont pas outstanding', () => {
    expect(isOutstanding('paye')).toBe(false);
    expect(isOutstanding('impaye')).toBe(false);
  });
});
