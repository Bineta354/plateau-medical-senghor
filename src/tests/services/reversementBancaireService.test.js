import { listReversements, createReversement, getSessionsAvecEncaissements } from '../../services/reversementBancaireService';
import { supabase } from '../../lib/supabase';

// Constante interne au service (non exportée) — dupliquée ici volontairement pour
// pouvoir déclencher le garde-fou `truncated` dans les tests ci-dessous. Si elle change
// côté service, le test "signale truncated" doit être mis à jour en conséquence.
const PAIEMENTS_FETCH_LIMIT = 3000;

// Constructeur de faux query-builder Supabase : chaque méthode de chaînage (select, order,
// limit, eq, gte, lte, in, insert) retourne le builder lui-même, et le builder est
// "thenable" pour reproduire le comportement réel de supabase-js où `await query` déclenche
// la requête sans appel explicite à .single() (utilisé par listReversements et
// getSessionsAvecEncaissements, contrairement à createReversement qui appelle .single()).
const makeThenable = (result) => {
  const builder = {};
  const chain = jest.fn(() => builder);
  builder.select = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.insert = chain;
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

describe('reversementBancaireService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listReversements', () => {
    test('retourne la liste fournie par supabase', async () => {
      const rows = [{ id: 1, montant: 5000, mode: 'virement' }];
      supabase.from.mockReturnValue(makeThenable({ data: rows, error: null }));

      const result = await listReversements({ dateDebut: '2026-08-01', dateFin: '2026-08-31' });

      expect(supabase.from).toHaveBeenCalledWith('reversements_bancaires');
      expect(result).toEqual(rows);
    });

    test('renvoie un tableau vide quand data est null', async () => {
      supabase.from.mockReturnValue(makeThenable({ data: null, error: null }));

      const result = await listReversements();

      expect(result).toEqual([]);
    });

    test('propage une erreur supabase', async () => {
      supabase.from.mockReturnValue(makeThenable({ data: null, error: new Error('boom') }));

      await expect(listReversements()).rejects.toThrow('boom');
    });
  });

  describe('createReversement', () => {
    test('rejette un montant à 0 sans appeler supabase', async () => {
      await expect(
        createReversement({ dateReversement: '2026-08-10', montant: 0, mode: 'virement' })
      ).rejects.toThrow('Montant invalide');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    test('rejette un montant négatif sans appeler supabase', async () => {
      await expect(
        createReversement({ dateReversement: '2026-08-10', montant: -100, mode: 'virement' })
      ).rejects.toThrow('Montant invalide');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    test('insère un reversement avec un montant valide (chaîne numérique acceptée)', async () => {
      const inserted = { id: 10, montant: 15000, mode: 'depot_especes' };
      supabase.from.mockReturnValue(makeThenable({ data: inserted, error: null }));

      const result = await createReversement({
        dateReversement: '2026-08-10',
        montant: '15000',
        mode: 'depot_especes',
        caissierId: 3,
        sessionCaisseId: 7,
      });

      expect(supabase.from).toHaveBeenCalledWith('reversements_bancaires');
      expect(result).toEqual(inserted);
    });

    test('propage une erreur supabase lors de l\'insertion', async () => {
      supabase.from.mockReturnValue(makeThenable({ data: null, error: new Error('insert failed') }));

      await expect(
        createReversement({ dateReversement: '2026-08-10', montant: 1000, mode: 'virement' })
      ).rejects.toThrow('insert failed');
    });
  });

  describe('getSessionsAvecEncaissements', () => {
    test('calcule le reste à reverser (espèces encaissées - déjà reversé) et exclut les autres modes', async () => {
      const sessions = [
        {
          id: 1,
          date_session: '2026-08-05',
          caissier_id: 3,
          fond_caisse: 20000,
          montant_journalier: 50000,
          users: { prenom: 'Awa', nom: 'Diop' },
        },
      ];
      const paiements = [
        { montant: 30000, mode_paiement: 'especes', caissier_id: 3, date_paiement: '2026-08-05T10:00:00' },
        { montant: 20000, mode_paiement: 'carte', caissier_id: 3, date_paiement: '2026-08-05T11:00:00' },
        // Autre jour : ne doit pas être compté
        { montant: 99999, mode_paiement: 'especes', caissier_id: 3, date_paiement: '2026-08-06T09:00:00' },
        // Autre caissier le même jour : ne doit pas être compté
        { montant: 88888, mode_paiement: 'especes', caissier_id: 4, date_paiement: '2026-08-05T09:00:00' },
      ];
      const reversements = [{ session_caisse_id: 1, montant: 10000 }];

      supabase.from.mockImplementation((table) => {
        if (table === 'sessions_caisse') return makeThenable({ data: sessions, error: null });
        if (table === 'paiements') return makeThenable({ data: paiements, error: null });
        if (table === 'reversements_bancaires') return makeThenable({ data: reversements, error: null });
        throw new Error(`Table inattendue : ${table}`);
      });

      const { sessions: result, truncated } = await getSessionsAvecEncaissements({});

      expect(result).toHaveLength(1);
      expect(result[0].par_mode).toEqual({ especes: 30000, carte: 20000 });
      expect(result[0].especes).toBe(30000);
      expect(result[0].deja_reverse).toBe(10000);
      expect(result[0].reste_a_reverser).toBe(20000);
      expect(truncated).toBe(false);
    });

    test('ne borne pas le reste à reverser si déjà reversé dépasse les espèces (peut devenir négatif)', async () => {
      const sessions = [{ id: 2, date_session: '2026-08-05', caissier_id: null, fond_caisse: 0, montant_journalier: 5000, users: null }];
      const paiements = [
        { montant: 5000, mode_paiement: 'especes', caissier_id: null, date_paiement: '2026-08-05T08:00:00' },
      ];
      const reversements = [{ session_caisse_id: 2, montant: 8000 }];

      supabase.from.mockImplementation((table) => {
        if (table === 'sessions_caisse') return makeThenable({ data: sessions, error: null });
        if (table === 'paiements') return makeThenable({ data: paiements, error: null });
        if (table === 'reversements_bancaires') return makeThenable({ data: reversements, error: null });
      });

      const { sessions: result } = await getSessionsAvecEncaissements({});

      expect(result[0].reste_a_reverser).toBe(-3000);
    });

    test('retourne un tableau vide et ne fait qu\'un seul appel supabase si aucune session', async () => {
      supabase.from.mockReturnValue(makeThenable({ data: [], error: null }));

      const { sessions, truncated } = await getSessionsAvecEncaissements({});

      expect(sessions).toEqual([]);
      expect(truncated).toBe(false);
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    test('signale truncated=true quand le nombre de paiements atteint le plafond de sécurité', async () => {
      const sessions = [{ id: 1, date_session: '2026-08-05', caissier_id: null, fond_caisse: 0, montant_journalier: 0, users: null }];
      const paiements = Array.from({ length: PAIEMENTS_FETCH_LIMIT }, () => ({
        montant: 100,
        mode_paiement: 'especes',
        caissier_id: null,
        date_paiement: '2026-08-05T00:00:00',
      }));

      supabase.from.mockImplementation((table) => {
        if (table === 'sessions_caisse') return makeThenable({ data: sessions, error: null });
        if (table === 'paiements') return makeThenable({ data: paiements, error: null });
        if (table === 'reversements_bancaires') return makeThenable({ data: [], error: null });
      });

      const { truncated } = await getSessionsAvecEncaissements({});

      expect(truncated).toBe(true);
    });

    test('propage une erreur supabase sur la lecture des sessions', async () => {
      supabase.from.mockReturnValue(makeThenable({ data: null, error: new Error('sessions unreachable') }));

      await expect(getSessionsAvecEncaissements({})).rejects.toThrow('sessions unreachable');
    });
  });
});
