import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, AlertTriangle, Bell, RefreshCw,
  Mail, Smartphone, TrendingUp, Users, ShieldCheck
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

/**
 * Impayés & Relances — fusion de AlertesImpayes.jsx (comptabilité) et
 * caissier/Relances.jsx (même requête factures en_attente/partiel dupliquée
 * en deux endroits). Ajoute un onglet "Créances assurance" : les deux écrans
 * fusionnés excluaient systématiquement les factures type='couverture'
 * (facture_parent_id renseigné), rendant la part assurance impayée invisible
 * partout dans l'application.
 *
 * Échéance calculée en dur à date_facture + 30 jours (aucune colonne
 * date_echeance en base actuellement — voir le chantier DB séparé).
 */

const SEVERITE_SEUILS = { critique: 60, eleve: 30 };

const computeSeverite = (retard) => {
  if (retard > SEVERITE_SEUILS.critique) return 'critique';
  if (retard > SEVERITE_SEUILS.eleve) return 'eleve';
  return 'moyen';
};

const getSeveriteColor = (severite) => {
  switch (severite) {
    case 'critique': return 'bg-red-100 text-red-800 border-red-200';
    case 'eleve': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'moyen': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSeveriteLabel = (severite) => {
  switch (severite) {
    case 'critique': return 'Critique';
    case 'eleve': return 'Élevée';
    default: return 'Moyenne';
  }
};

const ImpayesRelances = () => {
  const [tab, setTab] = useState('patients'); // 'patients' | 'assurance'
  const [loading, setLoading] = useState(true);
  const [patientsItems, setPatientsItems] = useState([]);
  const [assuranceItems, setAssuranceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverite, setFilterSeverite] = useState('all');
  const [sending, setSending] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    chargerCreances();
  }, []);

  const chargerCreances = async () => {
    setLoading(true);
    try {
      const [{ data: patientFactures, error: e1 }, { data: couvertureFactures, error: e2 }] = await Promise.all([
        supabase
          .from('factures')
          .select(`
            id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
            statut_paiement, patient_id, assurance_id,
            patients ( id, nom, prenom, email, telephone ),
            assurances ( id, nom )
          `)
          .is('facture_parent_id', null)
          .in('statut_paiement', ['en_attente', 'partiel'])
          .order('date_facture', { ascending: false })
          .limit(500),
        supabase
          .from('factures')
          .select(`
            id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
            statut_paiement, patient_id, assurance_id, facture_parent_id,
            patients ( id, nom, prenom ),
            assurances ( id, nom )
          `)
          .eq('type', 'couverture')
          .neq('statut_paiement', 'paye')
          .order('date_facture', { ascending: false })
          .limit(500),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;

      // --- Créances patients : groupées par patient ---
      const byPatient = {};
      (patientFactures || []).forEach((f) => {
        const pid = f.patient_id || f.patients?.id;
        if (!pid) return;
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        if (restant <= 0) return;

        const dateFacture = new Date(f.date_facture);
        const dateEcheance = new Date(dateFacture);
        dateEcheance.setDate(dateEcheance.getDate() + 30);
        const retard = Math.max(0, Math.floor((new Date() - dateEcheance) / (1000 * 60 * 60 * 24)));
        const severite = computeSeverite(retard);

        if (!byPatient[pid]) {
          byPatient[pid] = { patient: f.patients, factures: [], totalRestant: 0, severiteMax: 'moyen' };
        }
        byPatient[pid].factures.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          date_echeance: dateEcheance.toISOString().split('T')[0],
          montant_ttc: parseFloat(f.montant_ttc || 0),
          montant_paye: parseFloat(f.montant_paye || 0),
          restant,
          retard,
          severite,
        });
        byPatient[pid].totalRestant += restant;
        if (severite === 'critique') byPatient[pid].severiteMax = 'critique';
        else if (severite === 'eleve' && byPatient[pid].severiteMax !== 'critique') byPatient[pid].severiteMax = 'eleve';
      });
      setPatientsItems(Object.values(byPatient));

      // --- Créances assurance : groupées par assureur ---
      const byAssurance = {};
      (couvertureFactures || []).forEach((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        if (restant <= 0) return;
        const aid = f.assurance_id || 'sans_assurance';
        if (!byAssurance[aid]) {
          byAssurance[aid] = { assurance: f.assurances || { nom: 'Assureur non renseigné' }, factures: [], totalRestant: 0 };
        }
        byAssurance[aid].factures.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          patient: f.patients,
          montant_ttc: parseFloat(f.montant_ttc || 0),
          montant_paye: parseFloat(f.montant_paye || 0),
          restant,
        });
        byAssurance[aid].totalRestant += restant;
      });
      setAssuranceItems(Object.values(byAssurance));
    } catch (e) {
      console.error('Erreur lors du chargement des créances:', e);
      setPatientsItems([]);
      setAssuranceItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRelanceEmail = async (item) => {
    setSending({ type: 'email', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API email — actuellement non implémenté.
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'info', msg: `Relance email préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const handleRelanceSms = async (item) => {
    setSending({ type: 'sms', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API SMS — actuellement non implémenté.
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'info', msg: `Relance SMS préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const filteredPatients = patientsItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      `${item.patient?.prenom} ${item.patient?.nom}`.toLowerCase().includes(term) ||
      item.patient?.email?.toLowerCase().includes(term) ||
      item.patient?.telephone?.includes(term) ||
      item.factures.some((f) => f.numero_facture.toLowerCase().includes(term));
    const matchesSeverite = filterSeverite === 'all' || item.severiteMax === filterSeverite;
    return matchesSearch && matchesSeverite;
  });

  const filteredAssurance = assuranceItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      item.assurance?.nom?.toLowerCase().includes(term) ||
      item.factures.some((f) => f.numero_facture.toLowerCase().includes(term) || `${f.patient?.prenom} ${f.patient?.nom}`.toLowerCase().includes(term))
    );
  });

  const statsPatients = {
    total: patientsItems.length,
    critiques: patientsItems.filter((i) => i.severiteMax === 'critique').length,
    montantTotal: patientsItems.reduce((sum, i) => sum + i.totalRestant, 0),
  };
  const statsAssurance = {
    total: assuranceItems.length,
    montantTotal: assuranceItems.reduce((sum, i) => sum + i.totalRestant, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement des créances...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-600" />
            Impayés & Relances
          </h1>
          <p className="text-gray-600 mt-2">
            Créances patients et créances assurance (échéance estimée à 30 jours après émission)
          </p>
        </div>
        <button
          onClick={chargerCreances}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Actualiser
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-lg border text-sm bg-blue-50 border-blue-200 text-blue-800" role="alert">
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('patients')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'patients' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" /> Créances patients ({statsPatients.total})
        </button>
        <button
          onClick={() => setTab('assurance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'assurance' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Créances assurance ({statsAssurance.total})
        </button>
      </div>

      {tab === 'patients' ? (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Patients concernés</p>
                  <p className="text-2xl font-bold text-gray-900">{statsPatients.total}</p>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Situations critiques (&gt;60j)</p>
                  <p className="text-2xl font-bold text-red-600">{statsPatients.critiques}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Montant total dû</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMontant(statsPatients.montantTotal)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Filtres */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 inline mr-1" /> Recherche
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Patient, facture, téléphone, email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sévérité</label>
                <select
                  value={filterSeverite}
                  onChange={(e) => setFilterSeverite(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Toutes</option>
                  <option value="critique">Critique</option>
                  <option value="eleve">Élevée</option>
                  <option value="moyen">Moyenne</option>
                </select>
              </div>
            </div>
          </div>

          {/* Liste */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Sévérité</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Reste à payer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Factures</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {patientsItems.length === 0 ? 'Aucune créance patient en cours.' : 'Aucun résultat pour cette recherche.'}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((item) => (
                    <tr key={item.patient?.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.patient?.prenom} {item.patient?.nom}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600">{item.patient?.email || '–'}</div>
                        <div className="text-gray-500 text-xs">{item.patient?.telephone || '–'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeveriteColor(item.severiteMax)}`}>
                          {getSeveriteLabel(item.severiteMax)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">{formatMontant(item.totalRestant)}</td>
                      <td className="px-4 py-3">
                        {item.factures.map((f) => (
                          <span key={f.id} className="mr-2 mb-1 inline-block text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {f.numero_facture} ({formatMontant(f.restant)}, {f.retard}j)
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRelanceEmail(item)}
                            disabled={!!sending}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                            title="Envoyer relance email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRelanceSms(item)}
                            disabled={!!sending}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                            title="Envoyer relance SMS"
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Statistiques assurance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Assureurs concernés</p>
                  <p className="text-2xl font-bold text-gray-900">{statsAssurance.total}</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Montant total dû par les assureurs</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMontant(statsAssurance.montantTotal)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" /> Recherche
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Assureur, facture, patient..."
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Assureur</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Reste dû</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Factures couverture concernées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssurance.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      {assuranceItems.length === 0
                        ? "Aucune créance assurance en cours (les factures de couverture n'apparaissaient auparavant dans aucun écran)."
                        : 'Aucun résultat pour cette recherche.'}
                    </td>
                  </tr>
                ) : (
                  filteredAssurance.map((item, idx) => (
                    <tr key={item.assurance?.id ?? idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.assurance?.nom}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">{formatMontant(item.totalRestant)}</td>
                      <td className="px-4 py-3">
                        {item.factures.map((f) => (
                          <span key={f.id} className="mr-2 mb-1 inline-block text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {f.numero_facture} — {f.patient?.prenom} {f.patient?.nom} ({formatMontant(f.restant)})
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ImpayesRelances;
