import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCardIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatMontant } from '../../utils/currency';

const MODES = [
  { value: 'virement', label: 'Virement' },
  { value: 'depot_especes', label: 'Dépôt espèces' },
  { value: 'remise_cheques', label: 'Remise chèques' },
  { value: 'autre', label: 'Autre' },
];

const ReversementBancaire = () => {
  const { userProfile } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('month'); // 'month' | 'last_month' | 'range'
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [form, setForm] = useState({
    date_reversement: new Date().toISOString().slice(0, 10),
    montant: '',
    mode: 'virement',
    reference_banque: '',
    banque_nom: '',
    compte_iban: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const getDateRange = () => {
    const now = new Date();
    let debut = new Date(now.getFullYear(), now.getMonth(), 1);
    let fin = new Date(now);
    if (filterPeriod === 'last_month') {
      debut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      fin = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filterPeriod === 'range' && dateDebut && dateFin) {
      debut = new Date(dateDebut);
      fin = new Date(dateFin);
    }
    return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
  };

  const fetchReversements = async () => {
    setLoading(true);
    setError(null);
    try {
      const { debut, fin } = getDateRange();
      let q = supabase
        .from('reversements_bancaires')
        .select(`
          id,
          date_reversement,
          montant,
          mode,
          reference_banque,
          banque_nom,
          compte_iban,
          notes,
          caissier_id,
          users ( prenom, nom )
        `)
        .order('date_reversement', { ascending: false })
        .limit(500);
      if (filterPeriod !== 'all') {
        q = q.gte('date_reversement', debut).lte('date_reversement', fin);
      }
      const { data, error: err } = await q;
      if (err) throw err;
      setList(data || []);
    } catch (e) {
      setError(e?.message || 'Erreur chargement');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReversements();
  }, [filterPeriod, dateDebut, dateFin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const montant = parseFloat(form.montant);
    if (!montant || montant <= 0) {
      setError('Montant invalide');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('reversements_bancaires').insert({
        date_reversement: form.date_reversement,
        montant,
        mode: form.mode,
        reference_banque: form.reference_banque || null,
        banque_nom: form.banque_nom || null,
        compte_iban: form.compte_iban || null,
        notes: form.notes || null,
        caissier_id: userProfile?.id || null,
      });
      if (err) throw err;
      setForm({
        date_reversement: new Date().toISOString().slice(0, 10),
        montant: '',
        mode: 'virement',
        reference_banque: '',
        banque_nom: '',
        compte_iban: '',
        notes: '',
      });
      setShowForm(false);
      fetchReversements();
    } catch (e) {
      setError(e?.message || 'Erreur enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const total = list.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
  const caissierName = (r) => {
    const u = r.users;
    return u && typeof u === 'object' ? `${u.prenom || ''} ${u.nom || ''}`.trim() || '–' : '–';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <CreditCardIcon className="w-8 h-8 text-indigo-600" />
        Reversement bancaire
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-gray-600">
          Enregistrez les versements de la caisse vers le compte bancaire du cabinet.
        </p>
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(null); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" /> Nouveau reversement
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-indigo-200">
          <h2 className="text-lg font-semibold mb-4">Nouveau reversement</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date_reversement}
                onChange={(e) => setForm((f) => ({ ...f, date_reversement: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (F CFA)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.montant}
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Référence banque</label>
              <input
                type="text"
                value={form.reference_banque}
                onChange={(e) => setForm((f) => ({ ...f, reference_banque: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="N° opération"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banque</label>
              <input
                type="text"
                value={form.banque_nom}
                onChange={(e) => setForm((f) => ({ ...f, banque_nom: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Nom de la banque"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compte (IBAN)</label>
              <input
                type="text"
                value={form.compte_iban}
                onChange={(e) => setForm((f) => ({ ...f, compte_iban: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Optionnel"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Filtrer par période</h3>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="month">Ce mois</option>
            <option value="last_month">Mois dernier</option>
            <option value="range">Du ... au ...</option>
            <option value="all">Tout</option>
          </select>
          {filterPeriod === 'range' && (
            <>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </>
          )}
          <button
            type="button"
            onClick={fetchReversements}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm"
          >
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <span className="font-medium text-gray-700">Historique des reversements</span>
            <span className="text-sm text-gray-600">Total affiché : {formatMontant(total)}</span>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Montant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Mode</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Référence / Banque</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Caissier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {list.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun reversement pour cette période.</td></tr>
              ) : (
                list.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.date_reversement}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMontant(parseFloat(r.montant || 0))}</td>
                    <td className="px-4 py-3">{MODES.find((m) => m.value === r.mode)?.label || r.mode}</td>
                    <td className="px-4 py-3">{r.reference_banque || r.banque_nom || '–'}</td>
                    <td className="px-4 py-3">{caissierName(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReversementBancaire;
