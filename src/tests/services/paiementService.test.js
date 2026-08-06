import { enregistrerPaiement } from '../../services/paiementService';
import { supabase } from '../../lib/supabase';

const mockSingle = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: (...args) => mockSingle(...args),
    })),
  },
}));

describe('enregistrerPaiement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('écrit toujours factures ET paiements pour un encaissement partiel', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 1, montant_ttc: 10000, montant_paye: 0 }, error: null }) // lecture facture
      .mockResolvedValueOnce({ data: { id: 1, montant_paye: 4000, statut_paiement: 'partiel' }, error: null }) // update facture
      .mockResolvedValueOnce({ data: { id: 99, facture_id: 1, montant: 4000 }, error: null }); // insert paiement

    const result = await enregistrerPaiement({
      factureId: 1,
      montant: 4000,
      modePaiement: 'especes',
      caissierId: 7,
    });

    expect(supabase.from).toHaveBeenCalledWith('factures');
    expect(supabase.from).toHaveBeenCalledWith('paiements');
    expect(result.facture.statut_paiement).toBe('partiel');
    expect(result.paiement.montant).toBe(4000);
  });

  test('calcule le statut paye quand le montant total est atteint', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 2, montant_ttc: 10000, montant_paye: 6000 }, error: null })
      .mockResolvedValueOnce({ data: { id: 2, montant_paye: 10000, statut_paiement: 'paye' }, error: null })
      .mockResolvedValueOnce({ data: { id: 100, facture_id: 2, montant: 4000 }, error: null });

    const result = await enregistrerPaiement({
      factureId: 2,
      montant: 4000,
      modePaiement: 'carte',
    });

    expect(result.facture.statut_paiement).toBe('paye');
  });

  test("rejette un encaissement supérieur au reste à payer", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 3, montant_ttc: 10000, montant_paye: 8000 }, error: null });

    await expect(
      enregistrerPaiement({ factureId: 3, montant: 5000, modePaiement: 'especes' })
    ).rejects.toThrow('dépasse le reste à payer');
  });

  test('rejette un décaissement supérieur au montant déjà encaissé', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 4, montant_ttc: 10000, montant_paye: 2000 }, error: null });

    await expect(
      enregistrerPaiement({ factureId: 4, montant: -3000, modePaiement: 'especes' })
    ).rejects.toThrow('dépasse le montant déjà encaissé');
  });

  test('rejette un montant de 0', async () => {
    await expect(
      enregistrerPaiement({ factureId: 5, montant: 0, modePaiement: 'especes' })
    ).rejects.toThrow('différent de 0');
  });
});
