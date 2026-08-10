import { generateDossierAssurancePDF } from '../../services/impression/dossierAssurancePdf';
import jsPDF, { __mockDoc } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchParametres } from '../../services/parametrageService.js';
import { formatMontant } from '../../utils/currency';

// Même transformation que `formatDate` interne au module (non exportée) — on la reproduit
// ici plutôt que d'écrire des dates en dur, pour ne pas dépendre du fuseau horaire de la
// machine qui exécute les tests.
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');

jest.mock('jspdf', () => {
  const mockDoc = {
    internal: {
      pageSize: { width: 210, height: 297 },
      getNumberOfPages: jest.fn(() => 2),
    },
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    setFont: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addImage: jest.fn(),
    addPage: jest.fn(),
    setPage: jest.fn(),
    save: jest.fn(),
    lastAutoTable: undefined,
  };
  return { __esModule: true, default: jest.fn(() => mockDoc), __mockDoc: mockDoc };
});

jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  // Simule jspdf-autotable qui pose `doc.lastAutoTable.finalY` après rendu, utilisé par le
  // module pour positionner le tableau suivant.
  default: jest.fn((doc) => {
    doc.lastAutoTable = { finalY: (doc.lastAutoTable?.finalY || 20) + 30 };
  }),
}));

jest.mock('../../services/parametrageService.js', () => ({
  fetchParametres: jest.fn(),
}));

const makeSupabaseWithLignes = (lignesResult) => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn(() => Promise.resolve(lignesResult)),
  };
  return { from: jest.fn(() => builder) };
};

describe('generateDossierAssurancePDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockDoc.lastAutoTable = undefined;
  });

  test('renvoie une erreur sans toucher supabase ni jsPDF quand la liste de factures est vide', async () => {
    const supabase = { from: jest.fn() };

    const result = await generateDossierAssurancePDF(supabase, { assurance: { nom: 'NSIA' }, factures: [] });

    expect(result).toEqual({ success: false, error: 'Aucune facture à inclure dans le dossier.' });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(jsPDF).not.toHaveBeenCalled();
  });

  test('génère le bordereau : regroupe les lignes par facture parente, calcule le total et sauvegarde le PDF', async () => {
    fetchParametres.mockResolvedValue({
      nom_cabinet: 'Cabinet Test',
      adresse: '12 rue X',
      ville: 'Dakar',
      code_postal: '10000',
      logo_url: null,
    });

    const factures = [
      {
        numero_facture: 'F-001',
        date_facture: '2026-08-01',
        patient: { prenom: 'Awa', nom: 'Diop', numero_mutuelle: 'M123' },
        facture_parent_id: 10,
        restant: 15000,
        medecin: { prenom: 'Ibrahima', nom: 'Ndao' },
      },
      {
        numero_facture: 'F-002',
        date_facture: '2026-08-03',
        patient: { prenom: 'Moussa', nom: 'Fall' },
        facture_parent_id: 11,
        restant: 5000,
      },
    ];
    const lignes = [
      { facture_id: 10, description: 'Consultation', quantite: 1, prix_unitaire: 15000, montant_ligne: 15000 },
    ];
    const supabase = makeSupabaseWithLignes({ data: lignes, error: null });

    const result = await generateDossierAssurancePDF(
      supabase,
      { assurance: { nom: 'NSIA Assurance', taux_remboursement: 80 }, factures },
      'tenant-1'
    );

    expect(result).toEqual({ success: true });
    expect(fetchParametres).toHaveBeenCalledWith('tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('lignes_facture');

    // Tableau récapitulatif : une ligne par facture, total = 15000 + 5000
    const recapConfig = autoTable.mock.calls[0][1];
    expect(recapConfig.body).toEqual([
      ['F-001', fmtDate('2026-08-01'), 'Awa Diop', 'M123', formatMontant(15000)],
      ['F-002', fmtDate('2026-08-03'), 'Moussa Fall', '—', formatMontant(5000)],
    ]);
    expect(recapConfig.foot).toEqual([['', '', '', 'Total', formatMontant(20000)]]);

    // Détail facture 1 : lignes réelles récupérées via facture_parent_id = 10
    const detailConfig1 = autoTable.mock.calls[1][1];
    expect(detailConfig1.body).toEqual([['Consultation', 1, formatMontant(15000), formatMontant(15000)]]);

    // Détail facture 2 : aucune ligne trouvée pour facture_parent_id = 11 -> repli sur le restant
    const detailConfig2 = autoTable.mock.calls[2][1];
    expect(detailConfig2.body).toEqual([['Détail non disponible', '—', '—', formatMontant(5000)]]);

    expect(__mockDoc.save).toHaveBeenCalledTimes(1);
    const [fileName] = __mockDoc.save.mock.calls[0];
    expect(fileName).toMatch(/^Bordereau_NSIA_Assurance_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  test("ne requête pas lignes_facture quand aucune facture n'a de facture_parent_id (repli sur le montant restant)", async () => {
    fetchParametres.mockResolvedValue({ nom_cabinet: 'Cabinet Test' });
    const supabase = { from: jest.fn() };
    const factures = [
      { numero_facture: 'F-004', date_facture: '2026-08-01', patient: { prenom: 'X', nom: 'Y' }, facture_parent_id: null, restant: 2000 },
    ];

    const result = await generateDossierAssurancePDF(supabase, { assurance: { nom: 'Sanlam' }, factures });

    expect(result).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();
    const detailConfig = autoTable.mock.calls[1][1];
    expect(detailConfig.body).toEqual([['Détail non disponible', '—', '—', formatMontant(2000)]]);
  });

  test("renvoie success:false et le message d'erreur quand la lecture des lignes échoue", async () => {
    fetchParametres.mockResolvedValue({ nom_cabinet: 'Cabinet Test' });
    const supabase = makeSupabaseWithLignes({ data: null, error: { message: 'lignes_facture unreachable' } });
    const factures = [
      { numero_facture: 'F-003', date_facture: '2026-08-01', patient: {}, facture_parent_id: 20, restant: 1000 },
    ];

    const result = await generateDossierAssurancePDF(supabase, { assurance: { nom: 'AXA' }, factures });

    expect(result).toEqual({ success: false, error: 'lignes_facture unreachable' });
    expect(__mockDoc.save).not.toHaveBeenCalled();
  });

  test("utilise '—' comme numéro d'adhérent quand le patient n'a ni numero_mutuelle ni numero_ipm", async () => {
    fetchParametres.mockResolvedValue({ nom_cabinet: 'Cabinet Test' });
    const supabase = { from: jest.fn() };
    const factures = [
      { numero_facture: 'F-005', date_facture: '2026-08-01', patient: { prenom: 'Sans', nom: 'Adherent' }, facture_parent_id: null, restant: 1000 },
    ];

    await generateDossierAssurancePDF(supabase, { assurance: { nom: 'AXA' }, factures });

    const recapConfig = autoTable.mock.calls[0][1];
    expect(recapConfig.body[0][3]).toBe('—');
  });
});
