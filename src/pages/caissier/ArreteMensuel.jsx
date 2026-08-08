import React, { useState, useEffect, useRef } from 'react';
import { DocumentTextIcon, CalendarIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { formatMontant } from '../../utils/currency';
import KpiCard from '../../components/common/KpiCard';
import { getArreteComptableMensuel } from '../../services/sessionCaisseService';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const ArreteMensuel = () => {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const prevTitle = document.title;
    document.title = `Arrêté mensuel (Caisse) ${MOIS[mois - 1]} ${annee}`;
    window.print();
    document.title = prevTitle;
  };

  const fetchArrete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getArreteComptableMensuel({ annee, mois });
      setData(res || []);
    } catch (e) {
      setError(e?.message || 'Erreur chargement arrêté');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArrete();
  }, [annee, mois]);

  const totalFond = data.reduce((s, r) => s + parseFloat(r.fond_caisse || 0), 0);
  const totalJournalier = data.reduce((s, r) => s + parseFloat(r.montant_journalier || 0), 0);
  const totalSolde = data.reduce((s, r) => s + parseFloat(r.solde_final || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <DocumentTextIcon className="w-8 h-8 text-indigo-600" />
        Arrêté mensuel (Caisse)
      </h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Année</label>
            <select
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {[annee - 2, annee - 1, annee, annee + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mois</label>
            <select
              value={mois}
              onChange={(e) => setMois(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {MOIS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={fetchArrete}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Actualiser
          </button>
          {data.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm flex items-center gap-2"
            >
              <PrinterIcon className="w-5 h-5" /> Imprimer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Total fonds de caisse"
              value={formatMontant(totalFond)}
              className="rounded-lg p-4 bg-amber-50 hover:shadow-md"
              valueClassName="text-amber-600"
              labelClassName="text-amber-700"
            />
            <KpiCard label="Total encaissements" value={formatMontant(totalJournalier)} tone="green" />
            <KpiCard label="Total soldes fin de jour" value={formatMontant(totalSolde)} tone="blue" />
          </div>

          <div ref={printRef} className="bg-white rounded-xl shadow overflow-hidden print:shadow-none">
            <div className="px-4 py-2 border-b border-gray-200 print:block hidden md:block">
              <h2 className="text-lg font-semibold">Arrêté mensuel (Caisse) – {MOIS[mois - 1]} {annee}</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Fond caisse</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Encaissements</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Solde final</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Caissier</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune session pour ce mois.</td></tr>
                ) : (
                  data.map((row, index) => (
                    <tr key={`${row.date_session}-${row.caissier_nom || 'na'}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{row.date_session}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(parseFloat(row.fond_caisse || 0))}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(parseFloat(row.montant_journalier || 0))}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(parseFloat(row.solde_final || 0))}</td>
                      <td className="px-4 py-3">{row.caissier_nom || '–'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${row.statut === 'fermee' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {row.statut === 'fermee' ? 'Fermée' : 'Ouverte'}
                        </span>
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

export default ArreteMensuel;
