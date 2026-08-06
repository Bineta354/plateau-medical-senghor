import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  RefreshCw,
  Filter,
  Calendar,
  Search,
  TrendingUp,
  CreditCard,
  Download,
  Eye,
  BarChart3,
  Coins,
  Clock,
  User,
  Receipt,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMontant } from '../../utils/currency';

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all', label: 'Tout' },
];

const getStartDateForPeriod = (period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
};

const SuiviCaissiers = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('today');
  const [selectedCaissierId, setSelectedCaissierId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [caissiers, setCaissiers] = useState([]);
  const [paiements, setPaiements] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: caissiersData, error: caissiersError } = await supabase.rpc('get_caissiers');

      if (caissiersError) throw caissiersError;
      setCaissiers(caissiersData || []);

      let query = supabase
        .from('paiements')
        .select(
          `id, date_paiement, montant, mode_paiement, statut, caissier_id,
           factures ( id, numero_facture, montant_ttc )`
        )
        .eq('statut', 'effectue')
        .order('date_paiement', { ascending: false })
        .limit(2000);

      const startDate = getStartDateForPeriod(period);
      if (startDate) {
        query = query.gte('date_paiement', startDate.toISOString());
      }

      if (selectedCaissierId !== 'all') {
        query = query.eq('caissier_id', selectedCaissierId);
      }

      const { data: paiementsData, error: paiementsError } = await query;
      if (paiementsError) throw paiementsError;

      setPaiements(paiementsData || []);
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement');
      setPaiements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, selectedCaissierId]);

  const caissierById = useMemo(() => {
    const map = new Map();
    caissiers.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [caissiers]);

  const filteredPaiements = useMemo(() => {
    let filtered = paiements || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const caissier = caissierById.get(String(p.caissier_id));
        return (
          (p.factures?.numero_facture || '').toLowerCase().includes(term) ||
          (caissier ? `${caissier.prenom || ''} ${caissier.nom || ''}`.toLowerCase().includes(term) : false) ||
          (caissier?.username || '').toLowerCase().includes(term) ||
          (p.mode_paiement || '').toLowerCase().includes(term)
        );
      });
    }
    return filtered;
  }, [paiements, searchTerm, caissierById]);

  const totalsByCaissier = useMemo(() => {
    const acc = new Map();
    (filteredPaiements || []).forEach((p) => {
      const key = String(p.caissier_id);
      const cur = acc.get(key) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.montant || 0);
      acc.set(key, cur);
    });
    return Array.from(acc.entries())
      .map(([caissierId, v]) => ({
        caissierId,
        ...v,
        caissier: caissierById.get(caissierId),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPaiements, caissierById]);

  const grandTotal = useMemo(() => {
    return (filteredPaiements || []).reduce((sum, p) => sum + Number(p.montant || 0), 0);
  }, [filteredPaiements]);

  // Enhanced statistics
  const statsByMode = useMemo(() => {
    const acc = new Map();
    (filteredPaiements || []).forEach(p => {
      const mode = p.mode_paiement || 'autre';
      const prev = acc.get(mode) || { count: 0, total: 0 };
      prev.count += 1;
      prev.total += Number(p.montant || 0);
      acc.set(mode, prev);
    });
    return acc;
  }, [filteredPaiements]);

  const statsByHour = useMemo(() => {
    const acc = new Map();
    (filteredPaiements || []).forEach(p => {
      if (!p.date_paiement) return;
      const hour = new Date(p.date_paiement).getHours();
      const key = `${hour}h-${hour + 1}h`;
      const prev = acc.get(key) || { count: 0, total: 0 };
      prev.count += 1;
      prev.total += Number(p.montant || 0);
      acc.set(key, prev);
    });
    return new Map([...acc.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0])));
  }, [filteredPaiements]);

  const averageTicket = useMemo(() => {
    const count = filteredPaiements.length;
    return count > 0 ? grandTotal / count : 0;
  }, [grandTotal, filteredPaiements]);

  // Export functionality
  const exportToCSV = () => {
    const headers = ['Date', 'Caissier', 'Facture', 'Mode', 'Montant'];
    const rows = filteredPaiements.map(p => [
      p.date_paiement ? new Date(p.date_paiement).toLocaleString('fr-FR') : '',
      caissierById.get(String(p.caissier_id)) ? 
        `${caissierById.get(String(p.caissier_id)).prenom} ${caissierById.get(String(p.caissier_id)).nom}` : '',
      p.factures?.numero_facture || '',
      p.mode_paiement || '',
      Number(p.montant || 0).toFixed(0)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `suivi_caissiers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" />
            Suivi des caissiers
          </h1>
          <p className="text-gray-600 mt-2">
            Contrôle des encaissements par caissier (lecture seule)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportToCSV}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter CSV
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Enhanced stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total encaissé</p>
              <p className="text-2xl font-bold text-gray-900">{formatMontant(grandTotal)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paiements</p>
              <p className="text-2xl font-bold text-gray-900">{filteredPaiements.length}</p>
            </div>
            <CreditCard className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket moyen</p>
              <p className="text-2xl font-bold text-gray-900">{formatMontant(averageTicket)}</p>
            </div>
            <Coins className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Caissiers actifs</p>
              <p className="text-2xl font-bold text-gray-900">{totalsByCaissier.length}</p>
            </div>
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Période</p>
              <p className="text-lg font-bold text-gray-900">
                {PERIODS.find((p) => p.value === period)?.label || period}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Caissier</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedCaissierId}
                onChange={(e) => setSelectedCaissierId(e.target.value)}
                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Tous les caissiers</option>
                {caissiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom} ({c.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Facture, caissier, mode..."
                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Payment mode distribution */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Répartition par mode de paiement
          </h2>
          <span className="text-sm text-gray-600">{statsByMode.size} mode(s)</span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(statsByMode.entries()).map(([mode, stats]) => {
              const percentage = grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0;
              const modeColors = {
                especes: 'bg-green-100 text-green-800 border-green-200',
                carte_bancaire: 'bg-blue-100 text-blue-800 border-blue-200',
                mobile_money: 'bg-purple-100 text-purple-800 border-purple-200',
                virement: 'bg-orange-100 text-orange-800 border-orange-200',
                cheque: 'bg-gray-100 text-gray-800 border-gray-200',
              };
              
              return (
                <div key={mode} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium capitalize">{mode.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${modeColors[mode] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold">{formatMontant(stats.total)}</div>
                    <div className="text-sm text-gray-600">{stats.count} transaction(s)</div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly activity */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Activité horaire
          </h2>
          <span className="text-sm text-gray-600">{statsByHour.size} tranche(s) horaire(s)</span>
        </div>

        <div className="p-6">
          <div className="space-y-2">
            {Array.from(statsByHour.entries()).map(([hourRange, stats]) => {
              const maxTotal = Math.max(...Array.from(statsByHour.values()).map(v => v.total));
              const width = maxTotal > 0 ? (stats.total / maxTotal) * 100 : 0;
              
              return (
                <div key={hourRange} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-600">{hourRange}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full flex items-center justify-end pr-2" 
                      style={{ width: `${width}%` }}
                    >
                      {width > 10 && (
                        <span className="text-xs text-white font-medium">
                          {formatMontant(stats.total)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <div className="text-sm font-medium">{formatMontant(stats.total)}</div>
                    <div className="text-xs text-gray-600">{stats.count} tx</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Synthèse par caissier
          </h2>
          <span className="text-sm text-gray-600">{totalsByCaissier.length} caissier(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caissier</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paiements</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ticket moyen</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Performance</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : totalsByCaissier.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucune donnée</td></tr>
              ) : (
                totalsByCaissier.map((row, index) => {
                  const avgTicket = row.count > 0 ? row.total / row.count : 0;
                  const performance = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
                  const isTopPerformer = index === 0 && row.total > 0;
                  
                  return (
                    <tr key={row.caissierId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {row.caissier ? `${row.caissier.prenom || ''} ${row.caissier.nom || ''}`.trim() : `#${row.caissierId}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              @{row.caissier?.username || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">{row.count}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatMontant(row.total)}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">{formatMontant(avgTicket)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${performance}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{performance.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isTopPerformer ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Top
                          </span>
                        ) : row.caissier?.actif ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            Inactif
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Détails des paiements
          </h2>
          <span className="text-sm text-gray-600">{filteredPaiements.length} paiement(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caissier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facture</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filteredPaiements.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucun paiement</td></tr>
              ) : (
                filteredPaiements.slice(0, 250).map((p) => {
                  const d = p.date_paiement ? new Date(p.date_paiement) : null;
                  const caissier = caissierById.get(String(p.caissier_id));
                  const modeColors = {
                    especes: 'bg-green-100 text-green-800 border-green-200',
                    carte_bancaire: 'bg-blue-100 text-blue-800 border-blue-200',
                    mobile_money: 'bg-purple-100 text-purple-800 border-purple-200',
                    virement: 'bg-orange-100 text-orange-800 border-orange-200',
                    cheque: 'bg-gray-100 text-gray-800 border-gray-200',
                  };
                  
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <div>{d ? d.toLocaleDateString('fr-FR') : '—'}</div>
                            <div className="text-xs text-gray-500">{d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="w-3 h-3 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {caissier ? `${caissier.prenom || ''} ${caissier.nom || ''}`.trim() : `#${p.caissier_id || '—'}`}
                            </div>
                            <div className="text-xs text-gray-500">@{caissier?.username || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-gray-400" />
                          <span className="font-mono">{p.factures?.numero_facture || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${modeColors[p.mode_paiement] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                          {p.mode_paiement?.replace('_', ' ') || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatMontant(p.montant)}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Effectué
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredPaiements.length > 250 && (
          <div className="px-6 py-4 text-sm text-gray-500 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Affichage limité à 250 lignes. Utilisez les filtres pour affiner les résultats.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviCaissiers;
