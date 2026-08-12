import { COUVERTURE_FETCH_LIMIT, isCouvertureListTruncated } from '../../config/creances';

describe('isCouvertureListTruncated', () => {
  test('retourne false quand la liste est vide', () => {
    expect(isCouvertureListTruncated([])).toBe(false);
  });

  test('retourne false quand la liste est sous le plafond', () => {
    const rows = new Array(COUVERTURE_FETCH_LIMIT - 1).fill({});
    expect(isCouvertureListTruncated(rows)).toBe(false);
  });

  test('retourne true quand la liste atteint exactement le plafond', () => {
    const rows = new Array(COUVERTURE_FETCH_LIMIT).fill({});
    expect(isCouvertureListTruncated(rows)).toBe(true);
  });

  test('retourne true quand la liste dépasse le plafond', () => {
    const rows = new Array(COUVERTURE_FETCH_LIMIT + 50).fill({});
    expect(isCouvertureListTruncated(rows)).toBe(true);
  });

  test('gère un tableau null/undefined comme non tronqué', () => {
    expect(isCouvertureListTruncated(null)).toBe(false);
    expect(isCouvertureListTruncated(undefined)).toBe(false);
  });

  test('respecte un plafond personnalisé passé en second argument', () => {
    expect(isCouvertureListTruncated([1, 2, 3], 3)).toBe(true);
    expect(isCouvertureListTruncated([1, 2], 3)).toBe(false);
  });
});
