import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Mail, Smartphone } from 'lucide-react';
import { formatMontant } from '../../utils/currency';

/**
 * Interface de relances (email / SMS) pour les factures impayées ou partiellement payées.
 * Liste les patients avec restes à payer et permet d'envoyer des relances (UI prête pour intégration API email/SMS).
 */
const Relances = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCouverture, setFilterCouverture] = useState('');
  const [searchPatient, setSearchPatient] = useState('');
  const [assurances, setAssurances] = useState([]);
  const [sending, setSending] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from('assurances').select('id, nom').order('nom');
      setAssurances(a || []);
    })();
  }, []);

  const fetchImpayes = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          date_facture,
          montant_ttc,
          montant_paye,
          montant_restant,
          statut_paiement,
          patient_id,
          assurance_id,
          patients ( id, nom, prenom, email, telephone ),
          assurances ( id, nom )
        `)
        .is('facture_parent_id', null)
        .or('statut_paiement.eq.en_attente,statut_paiement.eq.partiel');

      if (filterCouverture) q = q.eq('assurance_id', filterCouverture);

      const { data, error } = await q.order('date_facture', { ascending: false }).limit(500);

      if (error) throw error;

      const byPatient = {};
      (data || []).forEach((f) => {
        const pid = f.patient_id || f.patients?.id;
        if (!pid) return;
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        if (restant <= 0) return;
        if (!byPatient[pid]) {
          byPatient[pid] = {
            patient: f.patients,
            factures: [],
            totalRestant: 0,
          };
        }
        byPatient[pid].factures.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          montant_ttc: parseFloat(f.montant_ttc || 0),
          montant_paye: parseFloat(f.montant_paye || 0),
          restant,
          statut_paiement: f.statut_paiement,
          assurance: f.assurances?.nom,
        });
        byPatient[pid].totalRestant += restant;
      });

      setItems(Object.values(byPatient));
    } catch (e) {
      console.error('fetchImpayes:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImpayes();
  }, [filterCouverture]);

  const handleRelanceEmail = async (item) => {
    setSending({ type: 'email', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API email
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'success', msg: `Relance email préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const handleRelanceSms = async (item) => {
    setSending({ type: 'sms', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API SMS
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'success', msg: `Relance SMS préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const filteredItems = searchPatient.trim()
    ? items.filter((item) => {
        const term = searchPatient.trim().toLowerCase();
        return (
          (item.patient?.prenom || '').toLowerCase().includes(term) ||
          (item.patient?.nom || '').toLowerCase().includes(term) ||
          (item.patient?.email || '').toLowerCase().includes(term)
        );
      })
    : items;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <MessageSquare className="w-8 h-8 text-indigo-600" />
        Relances (email / SMS)
      </h1>

      {toast && (
        <div
          className={`mb-4 p-4 rounded-lg border text-sm ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
          role="alert"
        >
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="text-gray-600 mb-4">
          Patients avec factures impayées ou partiellement payées. Envoyez une relance par email ou SMS.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche patient</label>
            <input
              type="text"
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              placeholder="Nom, prénom ou email"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couverture</label>
            <select
              value={filterCouverture}
              onChange={(e) => setFilterCouverture(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              {assurances.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchImpayes}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Contact</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Reste à payer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Factures</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {items.length === 0
                      ? 'Aucun patient avec facture impayée ou partielle.'
                      : 'Aucun résultat pour cette recherche.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.patient?.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{item.patient?.prenom} {item.patient?.nom}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-600">{item.patient?.email || '–'}</div>
                      <div className="text-gray-500 text-xs">{item.patient?.telephone || '–'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">
                      {formatMontant(item.totalRestant)}
                    </td>
                    <td className="px-4 py-3">
                      {item.factures.map((f) => (
                        <span key={f.id} className="mr-2 text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {f.numero_facture} ({formatMontant(f.restant)})
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRelanceEmail(item)}
                        disabled={!!sending}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                        title="Envoyer relance email"
                      >
                        <Mail className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRelanceSms(item)}
                        disabled={!!sending}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                        title="Envoyer relance SMS"
                      >
                        <Smartphone className="w-5 h-5" />
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
  );
};

export default Relances;
