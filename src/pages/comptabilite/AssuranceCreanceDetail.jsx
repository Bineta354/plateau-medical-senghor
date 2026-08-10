import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, ShieldCheck, RefreshCw, Search, Inbox, AlertTriangle, FileDown } from 'lucide-react';
import { formatMontant } from '../../utils/currency';
import { COUVERTURE_FETCH_LIMIT, isCouvertureListTruncated } from '../../config/creances';
import { generateDossierAssurancePDF } from '../../services/impression/dossierAssurancePdf';
import useToast from '../../hooks/useToast';

/**
 * Détail des créances d'un assureur — accessible depuis Impayés & Relances
 * (onglet "Créances assurance"). La liste résumée là-bas ne montrait que
 * facture/patient/montant en badges compacts (illisible à partir d'une
 * vingtaine de factures) ; cette page donne le détail complet en tableau,
 * avec le médecin en plus (utile pour identifier d'où vient la créance).
 */

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const PAGE_SIZES = [10, 25, 50, 100];

const AssuranceCreanceDetail = () => {
  const { assuranceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assurance, setAssurance] = useState(null);
  const [factures, setFactures] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  // Pagination — même convention que le reste de l'app (voir CLAUDE.md) : jamais de
  // tableau qui grandit sans limite avec le volume (un assureur peut avoir des dizaines
  // de factures en attente).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [truncated, setTruncated] = useState(false);
  const [generatingDossier, setGeneratingDossier] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    let active = true;
    setPage(1);
    chargerDetail(() => active);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assuranceId]);

  // isCurrent() est fourni par l'effet ci-dessus : si l'assureur affiché a changé pendant que
  // cette requête était en vol (navigation rapide entre deux assureurs), les setState ci-dessous
  // sont sautés pour ne pas écraser les données déjà à jour avec une réponse obsolète.
  const chargerDetail = async (isCurrent = () => true) => {
    setLoading(true);
    try {
      const sansAssurance = assuranceId === 'sans_assurance';

      let query = supabase
        .from('factures')
        .select(`
          id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
          statut_paiement, patient_id, facture_parent_id,
          patients ( id, nom, prenom, numero_mutuelle, numero_ipm ),
          consultations ( date_consultation, medecin_id, users ( id, nom, prenom ) )
        `)
        .eq('type', 'couverture')
        .neq('statut_paiement', 'paye')
        .order('date_facture', { ascending: false })
        .limit(COUVERTURE_FETCH_LIMIT);

      query = sansAssurance ? query.is('assurance_id', null) : query.eq('assurance_id', assuranceId);

      const { data, error } = await query;
      if (error) throw error;
      if (!isCurrent()) return;

      setTruncated(isCouvertureListTruncated(data));

      const lignes = (data || [])
        .map((f) => ({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          facture_parent_id: f.facture_parent_id,
          patient: f.patients,
          medecin: f.consultations?.users,
          restant: parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0))),
        }))
        .filter((l) => l.restant > 0)
        .sort((a, b) => b.restant - a.restant);

      setFactures(lignes);

      if (sansAssurance) {
        setAssurance({ nom: 'Assureur non renseigné' });
      } else {
        const { data: assuranceData } = await supabase
          .from('assurances')
          .select('id, nom, taux_remboursement')
          .eq('id', assuranceId)
          .maybeSingle();
        if (!isCurrent()) return;
        setAssurance(assuranceData || { nom: 'Assureur' });
      }
    } catch (e) {
      if (!isCurrent()) return;
      console.error('Erreur chargement détail créance assurance:', e);
      setFactures([]);
      setAssurance(null);
      setTruncated(false);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const handleGenererDossier = async () => {
    setGeneratingDossier(true);
    try {
      const { success, error } = await generateDossierAssurancePDF(supabase, { assurance, factures });
      if (success) {
        showSuccess('Dossier assurance généré.');
      } else {
        showError(error || 'Erreur lors de la génération du dossier.');
      }
    } finally {
      setGeneratingDossier(false);
    }
  };

  const filtered = factures.filter((f) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      f.numero_facture.toLowerCase().includes(term) ||
      `${f.patient?.prenom} ${f.patient?.nom}`.toLowerCase().includes(term) ||
      `${f.medecin?.prenom} ${f.medecin?.nom}`.toLowerCase().includes(term)
    );
  });

  const totalGeneral = factures.reduce((sum, f) => sum + f.restant, 0);
  const totalFiltre = filtered.reduce((sum, f) => sum + f.restant, 0);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const start = (effectivePage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  useEffect(() => {
    if (totalPages >= 1 && page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement du détail...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/comptabilite/impayes')}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4" /> Retour à Impayés & Relances
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{assurance?.nom || 'Assureur'}</h1>
            <p className="text-sm text-gray-500">{factures.length} facture{factures.length > 1 ? 's' : ''} de couverture en attente</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Reste dû</p>
            <p className="text-2xl font-bold text-amber-700">{formatMontant(totalGeneral)}</p>
          </div>
          <button
            type="button"
            onClick={handleGenererDossier}
            disabled={generatingDossier || factures.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            {generatingDossier ? 'Génération…' : 'Générer le dossier'}
          </button>
        </div>
      </div>

      {truncated && (
        <div className="flex items-start gap-2 p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Plus de {COUVERTURE_FETCH_LIMIT} factures en attente pour cet assureur : le total affiché peut être
            sous-estimé (les plus anciennes ne sont pas comptées).
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] md:max-w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Patient, médecin, n° facture..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-600">Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-sm text-gray-600">entrées</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">
            {factures.length === 0 ? 'Aucune créance en attente pour cet assureur.' : 'Aucun résultat pour cette recherche.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">N° Facture</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Médecin</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.numero_facture}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(f.date_facture)}</td>
                    <td className="px-4 py-3 text-gray-900">{f.patient?.prenom} {f.patient?.nom}</td>
                    <td className="px-4 py-3 text-gray-600">{f.medecin ? `Dr. ${f.medecin.prenom} ${f.medecin.nom}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatMontant(f.restant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-700">
                    Total{filtered.length !== factures.length ? ' (résultats filtrés)' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatMontant(totalFiltre)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination: Affichage X à Y sur Z + Précédent / Suivant */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Affichage de {totalRows === 0 ? 0 : start + 1} à {Math.min(start + pageSize, totalRows)} sur {totalRows} entrées
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Précédent
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                Page {effectivePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={effectivePage >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssuranceCreanceDetail;
