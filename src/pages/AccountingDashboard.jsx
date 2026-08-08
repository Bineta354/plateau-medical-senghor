import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Stethoscope,
} from 'lucide-react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { formatMontant } from '../utils/currency';
import { getStatusLabel, isOutstanding } from '../utils/factureStatus';
import KpiCard from '../components/common/KpiCard';

/**
 * Tableau de bord comptable unique — fusionne l'ancien AccountingDashboard.jsx
 * (branché sur Supabase mais filtrait sur une nomenclature de statuts
 * 'payee'/'partiellement_payee'/'impayee' qui n'a jamais existé côté base,
 * le rendant silencieusement cassé) et TableauBordComptable.jsx (100% données
 * factices). Les vraies valeurs de statut_paiement sont en_attente/partiel/
 * paye/impaye (voir src/utils/factureStatus.js).
 *
 * Les widgets "Top médecins"/"Top services"/"Trésorerie" de l'ancien tableau
 * de bord mock ne sont pas reconstitués ici : ils reposaient sur des données
 * qui n'existent pas dans le schéma actuel (dépenses, satisfaction, service
 * par acte) et les refaire avec des données inventées aurait reproduit le
 * même problème. Seul un "Top médecins par chiffre facturé" (réel) est ajouté.
 */
const AccountingDashboard = () => {
  const navigate = useNavigate();
  const { showError, showInfo } = useToast();

  const [stats, setStats] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    unpaidInvoices: 0,
  });

  const [recentInvoices, setRecentInvoices] = useState([]);
  const [periodInvoices, setPeriodInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month'); // 'week' | 'month' | 'quarter' | 'year'

  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState('all');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const now = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'month':
        default:
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const { data: factures, error: facturesError } = await supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          date_facture,
          montant_ttc,
          montant_paye,
          montant_restant,
          statut_paiement,
          created_at,
          patient_id,
          patients ( id, nom, prenom ),
          consultations ( medecin_id, users ( id, nom, prenom ) )
        `)
        .gte('created_at', startDate.toISOString())
        .order('date_facture', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(250);

      if (facturesError) throw facturesError;

      const allInvoices = factures || [];
      setPeriodInvoices(allInvoices);

      setStats({
        totalInvoices: allInvoices.length,
        paidInvoices: allInvoices.filter((inv) => inv.statut_paiement === 'paye').length,
        pendingInvoices: allInvoices.filter((inv) => inv.statut_paiement === 'en_attente').length,
        unpaidInvoices: allInvoices.filter((inv) => inv.statut_paiement === 'impaye').length,
      });

      const recentData = allInvoices.slice(0, 10);
      setRecentInvoices(
        recentData.map((inv) => ({
          id: inv.id,
          created_at: inv.created_at,
          date_facture: inv.date_facture,
          numero_facture: inv.numero_facture,
          montant: inv.montant_ttc ?? 0,
          statut_paiement: inv.statut_paiement,
          patient_id: inv.patient_id,
          patient: inv.patients,
        })),
      );
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      showError('Erreur lors du chargement des données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const formatCfa = (amount) => formatMontant(amount || 0);

  const statusColorByKey = useMemo(() => ({
    paye: '#22C55E',
    partiel: '#F97316',
    en_attente: '#F59E0B',
    impaye: '#EF4444',
  }), []);

  const statusSeries = useMemo(() => ([
    { name: 'Payées', value: stats.paidInvoices, key: 'paye', color: statusColorByKey.paye },
    { name: 'Partielles', value: periodInvoices.filter((inv) => inv.statut_paiement === 'partiel').length, key: 'partiel', color: statusColorByKey.partiel },
    { name: 'En attente', value: stats.pendingInvoices, key: 'en_attente', color: statusColorByKey.en_attente },
    { name: 'Impayées', value: stats.unpaidInvoices, key: 'impaye', color: statusColorByKey.impaye },
  ]), [periodInvoices, stats, statusColorByKey]);

  const kpis = useMemo(() => {
    const billed = periodInvoices.reduce((sum, inv) => sum + (inv.montant_ttc ?? 0), 0);
    const collected = periodInvoices.reduce((sum, inv) => sum + (inv.montant_paye ?? 0), 0);
    const remaining = periodInvoices.reduce((sum, inv) => sum + (inv.montant_restant ?? 0), 0);
    const collectionRate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { billed, collected, remaining, collectionRate };
  }, [periodInvoices]);

  const aging = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: '0-7j', min: 0, max: 7, count: 0, amount: 0 },
      { label: '8-30j', min: 8, max: 30, count: 0, amount: 0 },
      { label: '31j+', min: 31, max: Infinity, count: 0, amount: 0 },
    ];

    for (const inv of periodInvoices) {
      if (!isOutstanding(inv.statut_paiement)) continue;
      const baseDate = inv.date_facture || inv.created_at;
      if (!baseDate) continue;
      const ageDays = Math.floor((now.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));
      const amount = inv.montant_restant ?? 0;
      const bucket = buckets.find((b) => ageDays >= b.min && ageDays <= b.max);
      if (bucket) {
        bucket.count += 1;
        bucket.amount += amount;
      }
    }

    const maxAmount = Math.max(1, ...buckets.map((b) => b.amount));
    return buckets.map((b) => ({ ...b, ratio: Math.round((b.amount / maxAmount) * 100) }));
  }, [periodInvoices]);

  const topOutstandingPatients = useMemo(() => {
    const map = new Map();
    for (const inv of periodInvoices) {
      if (!isOutstanding(inv.statut_paiement)) continue;
      const patient = inv.patients;
      if (!patient?.id) continue;
      const key = String(patient.id);
      const prev = map.get(key) || { patient, amount: 0, count: 0 };
      prev.amount += (inv.montant_restant ?? 0);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [periodInvoices]);

  const topMedecins = useMemo(() => {
    const map = new Map();
    for (const inv of periodInvoices) {
      const medecin = inv.consultations?.users;
      if (!medecin?.id) continue;
      const key = String(medecin.id);
      const prev = map.get(key) || { medecin, montant: 0, count: 0 };
      prev.montant += (inv.montant_ttc ?? 0);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.montant - a.montant).slice(0, 5);
  }, [periodInvoices]);

  const filteredRecentInvoices = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return recentInvoices.filter((inv) => {
      const matchesStatus = tableStatus === 'all' || inv.statut_paiement === tableStatus;
      if (!matchesStatus) return false;
      if (!q) return true;
      const patientName = inv.patient ? `${inv.patient.prenom || ''} ${inv.patient.nom || ''}`.toLowerCase() : '';
      const amountText = String(inv.montant || '').toLowerCase();
      const numberText = String(inv.numero_facture || inv.id || '').toLowerCase();
      return patientName.includes(q) || amountText.includes(q) || numberText.includes(q);
    });
  }, [recentInvoices, tableSearch, tableStatus]);

  const getStatusBadge = (status) => {
    const styles = {
      paye: 'bg-green-100 text-green-800',
      partiel: 'bg-orange-100 text-orange-800',
      en_attente: 'bg-yellow-100 text-yellow-800',
      impaye: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {getStatusLabel(status)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord - Comptabilité</h1>
          <p className="text-gray-600">Vue d'ensemble de la situation financière</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Période:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          icon={FileText}
          tone="blue"
          label="Total Factures"
          value={stats.totalInvoices}
          hoverMessage="Voir toutes les factures"
          onClick={() => navigate('/facturation/factures')}
        />
        <KpiCard
          icon={CheckCircle}
          tone="green"
          label="Factures Payées"
          value={stats.paidInvoices}
          hoverMessage="Voir les factures payées"
          onClick={() => navigate('/facturation/factures?status=paye')}
        />
        <KpiCard
          icon={Clock}
          tone="yellow"
          label="En Attente"
          value={stats.pendingInvoices}
          hoverMessage="Voir les factures en attente"
          onClick={() => navigate('/facturation/factures?status=en_attente')}
        />
        <KpiCard
          icon={AlertCircle}
          tone="red"
          label="Impayées"
          value={stats.unpaidInvoices}
          hoverMessage="Voir les factures impayées"
          onClick={() => navigate('/facturation/factures?status=impaye')}
        />
      </div>

      {/* Statistiques financières */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Répartition des statuts</h2>
              <p className="text-sm text-gray-600">Synthèse rapide des factures</p>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusSeries.filter((s) => s.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {statusSeries.filter((s) => s.value > 0).map((entry) => (
                      <Cell key={`cell-${entry.key}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {statusSeries.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => navigate(`/facturation/factures?status=${s.key}`)}
                  className="text-left px-3 py-2 rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-600">{s.name}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{s.value}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Priorité relances</h2>
              <p className="text-sm text-gray-600">Aging des restes à encaisser</p>
            </div>
            <div className="space-y-3">
              {aging.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => navigate('/facturation/factures?status=outstanding')}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{b.label}</span>
                    <span className="text-gray-600">{formatCfa(b.amount)} ({b.count})</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${b.ratio}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Top médecins</h2>
              <p className="text-sm text-gray-600">Chiffre facturé sur la période</p>
            </div>
            {topMedecins.length === 0 ? (
              <div className="text-sm text-gray-600">Aucune donnée sur la période.</div>
            ) : (
              <div className="space-y-2">
                {topMedecins.map((row) => (
                  <div key={row.medecin.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Dr. {row.medecin.prenom} {row.medecin.nom}</div>
                        <div className="text-xs text-gray-600">{row.count} facture(s)</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{formatMontant(row.montant)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <KpiCard
            icon={Coins}
            tone="green"
            label="Total facturé"
            value={formatMontant(kpis.billed)}
            hoverMessage="Voir les rapports détaillés (période non pré-filtrée)"
            onClick={() => navigate('/comptabilite/recherche-rapports')}
          />
          <KpiCard
            icon={Clock}
            tone="yellow"
            label="Encaissements"
            value={formatMontant(kpis.collected)}
            hoverMessage="Voir les factures payées"
            onClick={() => navigate('/facturation/factures?status=paye')}
          />
          <KpiCard
            icon={AlertCircle}
            tone="red"
            label="Reste à encaisser"
            value={formatMontant(kpis.remaining)}
            hoverMessage="Voir les factures non soldées"
            onClick={() => navigate('/facturation/factures?status=outstanding')}
          />
          <KpiCard
            icon={TrendingUp}
            tone="purple"
            label="Taux de recouvrement"
            value={`${kpis.collectionRate}%`}
            hoverMessage="Voir les rapports détaillés (période non pré-filtrée)"
            onClick={() => navigate('/comptabilite/recherche-rapports')}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Top restes à encaisser</h2>
                <p className="text-sm text-gray-600">Patients à relancer (période)</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/comptabilite/impayes')}
                className="text-sm font-medium text-purple-700 hover:text-purple-900"
              >
                Voir tout
              </button>
            </div>

            {topOutstandingPatients.length === 0 ? (
              <div className="text-sm text-gray-600">Aucun reste à encaisser sur la période.</div>
            ) : (
              <div className="space-y-2">
                {topOutstandingPatients.map((row) => {
                  const patientName = `${row.patient?.prenom || ''} ${row.patient?.nom || ''}`.trim();
                  const q = encodeURIComponent(patientName);
                  return (
                    <button
                      key={row.patient.id}
                      type="button"
                      onClick={() => navigate(`/facturation/factures?status=outstanding&q=${q}`)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">{patientName || 'Patient'}</div>
                        <div className="text-xs text-gray-600">{row.count} facture(s)</div>
                      </div>
                      <div className="text-sm font-semibold text-red-700">{formatCfa(row.amount)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions Rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button type="button" onClick={() => navigate('/facturation/factures?new=1')} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Créer une facture</div>
                <div className="text-xs text-gray-600 mt-1">Nouvelle facturation patient</div>
              </div>
              <div className="p-2 rounded-full bg-purple-100"><FileText className="w-5 h-5 text-purple-700" /></div>
            </div>
          </button>

          <button type="button" onClick={() => navigate('/comptabilite/impayes')} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Impayés & relances</div>
                <div className="text-xs text-gray-600 mt-1">Suivre les montants dus</div>
              </div>
              <div className="p-2 rounded-full bg-red-100"><AlertCircle className="w-5 h-5 text-red-700" /></div>
            </div>
          </button>

          <button type="button" onClick={() => navigate('/facturation/factures?status=partiel')} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Paiements partiels</div>
                <div className="text-xs text-gray-600 mt-1">Compléter les règlements</div>
              </div>
              <div className="p-2 rounded-full bg-orange-100"><Clock className="w-5 h-5 text-orange-700" /></div>
            </div>
          </button>

          <button type="button" onClick={() => navigate('/facturation/factures?status=en_attente')} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">En attente</div>
                <div className="text-xs text-gray-600 mt-1">Valider et encaisser</div>
              </div>
              <div className="p-2 rounded-full bg-yellow-100"><Clock className="w-5 h-5 text-yellow-700" /></div>
            </div>
          </button>

          <button type="button" onClick={() => navigate('/comptabilite/recherche-rapports')} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Rapports</div>
                <div className="text-xs text-gray-600 mt-1">Recherche et exports</div>
              </div>
              <div className="p-2 rounded-full bg-gray-100"><TrendingUp className="w-5 h-5 text-gray-700" /></div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              navigate('/facturation/factures');
              showInfo("Depuis la page Factures, utilise le bouton 'Exporter'.");
            }}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Exporter</div>
                <div className="text-xs text-gray-600 mt-1">CSV / impression / envoi</div>
              </div>
              <div className="p-2 rounded-full bg-blue-100"><FileText className="w-5 h-5 text-blue-700" /></div>
            </div>
          </button>
        </div>
      </div>

      {/* Factures récentes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Factures Récentes</h2>
              <p className="text-sm text-gray-600">Recherche et suivi rapide</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Rechercher (patient, montant, n°...)"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={tableStatus}
                onChange={(e) => setTableStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Tous statuts</option>
                <option value="paye">Payée</option>
                <option value="partiel">Partiellement payée</option>
                <option value="en_attente">En attente</option>
                <option value="impaye">Impayée</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecentInvoices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">Aucune facture récente</td>
                </tr>
              ) : (
                filteredRecentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.patient ? `${invoice.patient.prenom} ${invoice.patient.nom}` : 'Patient inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatMontant(invoice.montant)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(invoice.statut_paiement)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => {
                          const status = invoice.statut_paiement;
                          const patientName = invoice.patient ? `${invoice.patient.prenom || ''} ${invoice.patient.nom || ''}`.trim() : '';
                          const q = encodeURIComponent(patientName);
                          const statusParam = status ? `status=${encodeURIComponent(status)}` : '';
                          const qParam = patientName ? `q=${q}` : '';
                          const query = [statusParam, qParam].filter(Boolean).join('&');
                          navigate(`/facturation/factures${query ? `?${query}` : ''}`);
                        }}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;
