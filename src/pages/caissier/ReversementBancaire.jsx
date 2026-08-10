import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCardIcon, PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatMontant } from '../../utils/currency';
import {
  listReversements,
  createReversement,
  getSessionsAvecEncaissements,
} from '../../services/reversementBancaireService';

const MODES = [
  { value: 'virement', label: 'Virement' },
  { value: 'depot_especes', label: 'Dépôt espèces' },
  { value: 'remise_cheques', label: 'Remise chèques' },
  { value: 'autre', label: 'Autre' },
];

const MODES_PAIEMENT_LABELS = {
  especes: 'Espèces',
  wave: 'Wave',
  carte: 'Carte',
  cheque: 'Chèque',
  assurance: 'Assurance',
  monnaie_electronique: 'Monnaie électronique',
};
const labelModePaiement = (mode) => MODES_PAIEMENT_LABELS[mode] || (mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Autre');

const formatDateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

// Fonction plutôt que constante figée : sinon la date par défaut resterait celle du chargement
// initial de la page si elle reste ouverte après minuit.
const getFormVide = () => ({
  date_reversement: new Date().toISOString().slice(0, 10),
  montant: '',
  mode: 'virement',
  reference_banque: '',
  banque_nom: '',
  compte_iban: '',
  notes: '',
  session_caisse_id: null,
});

const ReversementBancaire = () => {
  const { userProfile } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsTruncated, setSessionsTruncated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('month'); // 'month' | 'last_month' | 'range'
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [form, setForm] = useState(getFormVide);
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
      const data = await listReversements(
        filterPeriod !== 'all' ? { dateDebut: debut, dateFin: fin } : {}
      );
      setList(data || []);
    } catch (e) {
      setError(e?.message || 'Erreur chargement');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const { debut, fin } = getDateRange();
      const { sessions: data, truncated } = await getSessionsAvecEncaissements(
        filterPeriod !== 'all' ? { dateDebut: debut, dateFin: fin } : {}
      );
      setSessions(data || []);
      setSessionsTruncated(truncated);
    } catch (e) {
      setError(e?.message || 'Erreur chargement des sessions de caisse');
      setSessions([]);
      setSessionsTruncated(false);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchReversements();
    fetchSessions();
  }, [filterPeriod, dateDebut, dateFin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const montant = parseFloat(form.montant.toString().replace(/\s/g, ''));
    if (!montant || montant <= 0) {
      setError('Montant invalide');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReversement({
        dateReversement: form.date_reversement,
        montant,
        mode: form.mode,
        referenceBanque: form.reference_banque || null,
        banqueNom: form.banque_nom || null,
        compteIban: form.compte_iban || null,
        notes: form.notes || null,
        caissierId: userProfile?.id || null,
        sessionCaisseId: form.session_caisse_id || null,
      });
      setForm(getFormVide());
      setShowForm(false);
      fetchReversements();
      fetchSessions();
    } catch (e) {
      setError(e?.message || 'Erreur enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const ouvrirFormulaireVide = () => {
    setForm(getFormVide());
    setShowForm(true);
    setError(null);
  };

  // Pré-remplit le formulaire avec le montant espèces restant à reverser pour cette session —
  // le caissier n'a plus qu'à confirmer (ou ajuster) au lieu de ressaisir le montant à la main.
  const ouvrirFormulairePourSession = (session) => {
    setForm({
      ...getFormVide(),
      date_reversement: session.date_session,
      montant: String(Math.max(session.reste_a_reverser, 0)),
      mode: 'depot_especes',
      session_caisse_id: session.id,
    });
    setShowForm(true);
    setError(null);
  };

  const total = list.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
  const caissierName = (r) => {
    const u = r.users;
    return u && typeof u === 'object' ? `${u.prenom || ''} ${u.nom || ''}`.trim() || '–' : '–';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
          onClick={ouvrirFormulaireVide}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" /> Nouveau reversement
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-indigo-200">
          <h2 className="text-lg font-semibold mb-1">Nouveau reversement</h2>
          {form.session_caisse_id ? (
            <p className="text-sm text-indigo-700 mb-4">
              Lié à la session de caisse du {formatDateFr(form.date_reversement)} — montant pré-rempli avec le reste
              à reverser en espèces pour cette session.
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-4">Reversement libre, non lié à une session de caisse.</p>
          )}
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
                type="text"
                min="1"
                step="1"
                value={form.montant ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(parseFloat(form.montant) || 0).replace(/\u00A0/g, ' ') : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '');
                  const numValue = parseFloat(value) || 0;
                  setForm((f) => ({ ...f, montant: numValue.toString() }));
                }}
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
            onClick={() => { fetchReversements(); fetchSessions(); }}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm"
          >
            Actualiser
          </button>
        </div>
      </div>

      {sessionsTruncated && (
        <div className="mb-4 p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Volume de paiements élevé sur cette période : la répartition par mode ci-dessous peut être incomplète.
            Réduisez la période pour un calcul fiable.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="font-medium text-gray-700">Sessions de caisse clôturées — traçabilité encaissement → reversement</span>
        </div>
        {loadingSessions ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Caissier</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Fond ouverture</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Répartition encaissée</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Total encaissé</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Déjà reversé</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Reste (espèces)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucune session clôturée pour cette période.</td></tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDateFr(s.date_session)}</td>
                      <td className="px-4 py-3">{s.caissier ? `${s.caissier.prenom || ''} ${s.caissier.nom || ''}`.trim() : 'Secrétariat'}</td>
                      <td className="px-4 py-3 text-right">{formatMontant(s.fond_caisse)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(s.par_mode).length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            Object.entries(s.par_mode).map(([mode, montant]) => (
                              <span key={mode} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                                {labelModePaiement(mode)} : {formatMontant(montant)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(s.montant_journalier)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatMontant(s.deja_reverse)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${s.reste_a_reverser > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                        {formatMontant(s.reste_a_reverser)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => ouvrirFormulairePourSession(s)}
                          disabled={s.reste_a_reverser <= 0}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          Reverser
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Session liée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {list.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun reversement pour cette période.</td></tr>
              ) : (
                list.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.date_reversement}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMontant(parseFloat(r.montant || 0))}</td>
                    <td className="px-4 py-3">{MODES.find((m) => m.value === r.mode)?.label || r.mode}</td>
                    <td className="px-4 py-3">{r.reference_banque || r.banque_nom || '–'}</td>
                    <td className="px-4 py-3">{caissierName(r)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.sessions_caisse?.date_session ? `Session du ${formatDateFr(r.sessions_caisse.date_session)}` : '—'}
                    </td>
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
