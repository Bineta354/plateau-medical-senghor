import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Download, RefreshCw, TrendingUp, Coins, FileText, Filter,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMontant } from '../../utils/currency';
import { getStatusColor, getStatusLabel } from '../../utils/factureStatus';
import { MODES_PAIEMENT, getModePaiementLabel } from '../../config/modesPaiement';
import KpiCard from '../../components/common/KpiCard';
import ExportUtils from '../../utils/ExportUtils';

/**
 * Recherche & Rapports — fusionne RechercheAvancee.jsx, RapportsFinanciers.jsx
 * et HistoriquePatient.jsx (tous les trois tournaient à 100% sur des données
 * factices, y compris des champs qui n'existent pas dans le schéma comme
 * "service", "priorité" ou "temps de traitement"). Remplacé par une seule
 * recherche multi-critères réelle sur `factures`, avec un résumé calculé sur
 * le résultat filtré (équivalent d'un "rapport" à la demande) et un export CSV.
 */
const DEFAULT_FILTERS = {
  q: '',
  statut: 'all',
  dateDebut: '',
  dateFin: '',
  medecinId: 'all',
  assuranceId: 'all',
  modePaiement: 'all',
  montantMin: '',
  montantMax: '',
};

const RechercheRapports = () => {
  const [factures, setFactures] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [assurances, setAssurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [expandedFilters, setExpandedFilters] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: a }] = await Promise.all([
        supabase.from('users').select('id, nom, prenom').eq('role', 'doctor').order('nom'),
        supabase.from('assurances').select('id, nom').order('nom'),
      ]);
      setMedecins(m || []);
      setAssurances(a || []);
    })();
    chargerFactures();
  }, []);

  const chargerFactures = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('factures')
        .select(`
          id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
          statut_paiement, mode_paiement, assurance_id, type,
          patients ( id, nom, prenom, telephone, email ),
          assurances ( id, nom ),
          consultations ( medecin_id, users ( id, nom, prenom ) )
        `)
        .order('date_facture', { ascending: false })
        .limit(500);

      if (filters.dateDebut) query = query.gte('date_facture', filters.dateDebut);
      if (filters.dateFin) query = query.lte('date_facture', filters.dateFin);
      if (filters.statut !== 'all') query = query.eq('statut_paiement', filters.statut);
      if (filters.assuranceId !== 'all') query = query.eq('assurance_id', filters.assuranceId);
      if (filters.modePaiement !== 'all') query = query.eq('mode_paiement', filters.modePaiement);

      const { data, error } = await query;
      if (error) throw error;
      setFactures(data || []);
    } catch (e) {
      console.error('Erreur lors du chargement des factures:', e);
      setFactures([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtres appliqués côté serveur au chargement ; recherche texte/médecin/montant en client
  // (jointure medecin et texte libre ne sont pas filtrables simplement côté SQL ici).
  const filteredFactures = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    const min = parseFloat(filters.montantMin) || null;
    const max = parseFloat(filters.montantMax) || null;
    return factures.filter((f) => {
      if (filters.medecinId !== 'all' && String(f.consultations?.medecin_id) !== String(filters.medecinId)) return false;
      if (min !== null && (f.montant_ttc ?? 0) < min) return false;
      if (max !== null && (f.montant_ttc ?? 0) > max) return false;
      if (!term) return true;
      const patientName = `${f.patients?.prenom || ''} ${f.patients?.nom || ''}`.toLowerCase();
      return (
        f.numero_facture?.toLowerCase().includes(term) ||
        patientName.includes(term) ||
        f.patients?.email?.toLowerCase().includes(term) ||
        f.patients?.telephone?.includes(term)
      );
    });
  }, [factures, filters.q, filters.medecinId, filters.montantMin, filters.montantMax]);

  const rapport = useMemo(() => {
    const totalFacture = filteredFactures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
    const totalEncaisse = filteredFactures.reduce((sum, f) => sum + (f.montant_paye || 0), 0);
    const totalRestant = filteredFactures.reduce((sum, f) => sum + (f.montant_restant || 0), 0);
    return {
      nombre: filteredFactures.length,
      totalFacture,
      totalEncaisse,
      totalRestant,
      tauxRecouvrement: totalFacture > 0 ? Math.round((totalEncaisse / totalFacture) * 100) : 0,
    };
  }, [filteredFactures]);

  const handleExportCsv = () => {
    const rows = filteredFactures.map((f) => ({
      numero: f.numero_facture,
      date: f.date_facture,
      patient: `${f.patients?.prenom || ''} ${f.patients?.nom || ''}`.trim(),
      medecin: f.consultations?.users ? `Dr. ${f.consultations.users.prenom} ${f.consultations.users.nom}` : '',
      type: f.type || 'patient',
      montantTtc: f.montant_ttc,
      paye: f.montant_paye,
      reste: f.montant_restant,
      statut: getStatusLabel(f.statut_paiement),
      modePaiement: f.mode_paiement ? getModePaiementLabel(f.mode_paiement) : '',
    }));
    ExportUtils.exportToCSV(rows, `recherche-factures-${new Date().toISOString().split('T')[0]}`, [
      { key: 'numero', label: 'Numéro' },
      { key: 'date', label: 'Date' },
      { key: 'patient', label: 'Patient' },
      { key: 'medecin', label: 'Médecin' },
      { key: 'type', label: 'Type' },
      { key: 'montantTtc', label: 'Montant TTC' },
      { key: 'paye', label: 'Payé' },
      { key: 'reste', label: 'Reste' },
      { key: 'statut', label: 'Statut' },
      { key: 'modePaiement', label: 'Mode paiement' },
    ]);
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Search className="w-8 h-8 text-purple-600" />
            Recherche & Rapports
          </h1>
          <p className="text-gray-600 mt-2">Recherche multi-critères sur les factures et export</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCsv} className="btn btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" /> Exporter CSV
          </button>
          <button onClick={chargerFactures} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> Actualiser
          </button>
        </div>
      </div>

      {/* Rapport / synthèse sur le résultat filtré */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <KpiCard label="Factures trouvées" value={rapport.nombre} tone="gray" />
        <KpiCard label="Total facturé" value={formatMontant(rapport.totalFacture)} tone="gray" />
        <KpiCard label="Encaissé" value={formatMontant(rapport.totalEncaisse)} tone="green" />
        <KpiCard
          label="Reste à encaisser"
          value={formatMontant(rapport.totalRestant)}
          className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
          valueClassName="text-orange-600"
          labelClassName="text-orange-700"
        />
        <KpiCard icon={TrendingUp} label="Taux de recouvrement" value={`${rapport.tauxRecouvrement}%`} tone="purple" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <button
          type="button"
          onClick={() => setExpandedFilters((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-4 h-4" /> Filtres avancés
          </span>
          {expandedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedFilters && (
          <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Recherche (patient, n° facture, email, téléphone)</label>
              <input
                type="text"
                value={filters.q}
                onChange={(e) => updateFilter('q', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
              <select
                value={filters.statut}
                onChange={(e) => updateFilter('statut', e.target.value)}
                onBlur={chargerFactures}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Tous</option>
                <option value="en_attente">En attente</option>
                <option value="partiel">Partiellement payée</option>
                <option value="paye">Payée</option>
                <option value="impaye">Impayée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Médecin</label>
              <select
                value={filters.medecinId}
                onChange={(e) => updateFilter('medecinId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Tous</option>
                {medecins.map((m) => (
                  <option key={m.id} value={m.id}>Dr. {m.prenom} {m.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assurance / couverture</label>
              <select
                value={filters.assuranceId}
                onChange={(e) => updateFilter('assuranceId', e.target.value)}
                onBlur={chargerFactures}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Toutes</option>
                {assurances.map((a) => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement</label>
              <select
                value={filters.modePaiement}
                onChange={(e) => updateFilter('modePaiement', e.target.value)}
                onBlur={chargerFactures}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Tous</option>
                {MODES_PAIEMENT.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
              <input
                type="date"
                value={filters.dateDebut}
                onChange={(e) => updateFilter('dateDebut', e.target.value)}
                onBlur={chargerFactures}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
              <input
                type="date"
                value={filters.dateFin}
                onChange={(e) => updateFilter('dateFin', e.target.value)}
                onBlur={chargerFactures}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Montant min</label>
              <input
                type="number"
                value={filters.montantMin}
                onChange={(e) => updateFilter('montantMin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Montant max</label>
              <input
                type="number"
                value={filters.montantMax}
                onChange={(e) => updateFilter('montantMax', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_FILTERS); chargerFactures(); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={chargerFactures}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Résultats */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Facture</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Médecin</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Montant</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Statut</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFactures.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-gray-300" />
                  Aucune facture ne correspond à ces critères
                </td>
              </tr>
            ) : (
              filteredFactures.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{f.numero_facture}</div>
                    <div className="text-xs text-gray-500">{new Date(f.date_facture).toLocaleDateString('fr-FR')}</div>
                  </td>
                  <td className="px-4 py-3">{f.patients?.prenom} {f.patients?.nom}</td>
                  <td className="px-4 py-3">
                    {f.consultations?.users ? `Dr. ${f.consultations.users.prenom} ${f.consultations.users.nom}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium text-gray-900">{formatMontant(f.montant_ttc)}</div>
                    {f.montant_restant > 0 && (
                      <div className="text-xs text-orange-600">Reste: {formatMontant(f.montant_restant)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(f.statut_paiement)}`}>
                      {getStatusLabel(f.statut_paiement)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {f.mode_paiement ? getModePaiementLabel(f.mode_paiement) : '–'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RechercheRapports;
