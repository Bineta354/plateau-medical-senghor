import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, 
  FileText, 
  TrendingUp, 
  Calendar,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Eye
} from 'lucide-react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatMontant } from '../utils/currency';

const AccountingDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  const [stats, setStats] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    unpaidInvoices: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingAmount: 0,
    unpaidAmount: 0
  });
  
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [periodInvoices, setPeriodInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month'); // 'week', 'month', 'year'

  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState('all');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Calculer les dates selon la période
      const now = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
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
          patients (
            id,
            nom,
            prenom
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('date_facture', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(250);

      if (facturesError) throw facturesError;

      const allInvoices = factures || [];
      setPeriodInvoices(allInvoices);

      const totalInvoices = allInvoices.length;
      const paidInvoices = allInvoices.filter(inv => inv.statut_paiement === 'payee').length;
      const pendingInvoices = allInvoices.filter(inv => inv.statut_paiement === 'en_attente' || inv.statut_paiement === 'partiellement_payee').length;
      const unpaidInvoices = allInvoices.filter(inv => inv.statut_paiement === 'impayee').length;

      const totalRevenue = allInvoices
        .filter(inv => inv.statut_paiement === 'payee')
        .reduce((sum, inv) => sum + (inv.montant_paye ?? inv.montant_ttc ?? 0), 0);

      const pendingAmount = allInvoices
        .filter(inv => inv.statut_paiement === 'en_attente' || inv.statut_paiement === 'partiellement_payee')
        .reduce((sum, inv) => sum + (inv.montant_restant ?? inv.montant_ttc ?? 0), 0);

      const unpaidAmount = allInvoices
        .filter(inv => inv.statut_paiement === 'impayee')
        .reduce((sum, inv) => sum + (inv.montant_restant ?? inv.montant_ttc ?? 0), 0);

      setStats({
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        unpaidInvoices,
        totalRevenue,
        monthlyRevenue: totalRevenue,
        pendingAmount,
        unpaidAmount
      });

      const recentData = allInvoices.slice(0, 10);
      const enrichedInvoices = recentData.map((inv) => ({
        id: inv.id,
        created_at: inv.created_at,
        date_facture: inv.date_facture,
        numero_facture: inv.numero_facture,
        montant: inv.montant_ttc ?? 0,
        statut_paiement: inv.statut_paiement,
        patient_id: inv.patient_id,
        patient: inv.patients
      }));

      setRecentInvoices(enrichedInvoices);

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      showError('Erreur lors du chargement des données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const formatCfa = (amount) => formatMontant(amount || 0);

  const statusColorByKey = useMemo(() => ({
    payee: '#22C55E',
    partiellement_payee: '#F97316',
    en_attente: '#F59E0B',
    impayee: '#EF4444'
  }), []);

  const statusSeries = useMemo(() => {
    const partiel = periodInvoices.filter(inv => inv.statut_paiement === 'partiellement_payee').length;
    return [
      { name: 'Payées', value: stats.paidInvoices, key: 'payee', color: statusColorByKey.payee },
      { name: 'Partielles', value: partiel, key: 'partiellement_payee', color: statusColorByKey.partiellement_payee },
      { name: 'En attente', value: periodInvoices.filter(inv => inv.statut_paiement === 'en_attente').length, key: 'en_attente', color: statusColorByKey.en_attente },
      { name: 'Impayées', value: stats.unpaidInvoices, key: 'impayee', color: statusColorByKey.impayee }
    ];
  }, [periodInvoices, stats.paidInvoices, stats.unpaidInvoices, statusColorByKey]);

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
      { label: '31j+', min: 31, max: Infinity, count: 0, amount: 0 }
    ];

    for (const inv of periodInvoices) {
      const isOutstanding = inv.statut_paiement !== 'payee' && inv.statut_paiement !== 'annulee';
      if (!isOutstanding) continue;

      const baseDate = inv.date_facture || inv.created_at;
      if (!baseDate) continue;
      const ageDays = Math.floor((now.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));
      const amount = inv.montant_restant ?? 0;
      const bucket = buckets.find(b => ageDays >= b.min && ageDays <= b.max);
      if (bucket) {
        bucket.count += 1;
        bucket.amount += amount;
      }
    }

    const maxAmount = Math.max(1, ...buckets.map(b => b.amount));
    return buckets.map(b => ({ ...b, ratio: Math.round((b.amount / maxAmount) * 100) }));
  }, [periodInvoices]);

  const topOutstandingPatients = useMemo(() => {
    const map = new Map();
    for (const inv of periodInvoices) {
      const isOutstanding = inv.statut_paiement !== 'payee' && inv.statut_paiement !== 'annulee';
      if (!isOutstanding) continue;
      const patient = inv.patients;
      if (!patient?.id) continue;
      const key = String(patient.id);
      const prev = map.get(key) || { patient, amount: 0, count: 0 };
      prev.amount += (inv.montant_restant ?? 0);
      prev.count += 1;
      map.set(key, prev);
    }

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [periodInvoices]);

  const filteredRecentInvoices = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return recentInvoices.filter((inv) => {
      const matchesStatus = tableStatus === 'all' || inv.statut_paiement === tableStatus;
      if (!matchesStatus) return false;

      if (!q) return true;
      const patientName = inv.patient ? `${inv.patient.prenom || ''} ${inv.patient.nom || ''}`.toLowerCase() : '';
      const amountText = String(inv.montant || '').toLowerCase();
      const numberText = String(inv.numero_facture || inv.numero || inv.id || '').toLowerCase();
      return patientName.includes(q) || amountText.includes(q) || numberText.includes(q);
    });
  }, [recentInvoices, tableSearch, tableStatus]);

  const getStatCard = (title, value, icon, color, trend = null, onClick = null) => (
    <button
      type="button"
      onClick={onClick || undefined}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left ${onClick ? 'hover:shadow-md hover:border-gray-300 transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className={`flex items-center text-sm mt-1 ${
              trend.value > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.value > 0 ? (
                <ArrowUpRight className="w-4 h-4 mr-1" />
              ) : (
                <ArrowDownRight className="w-4 h-4 mr-1" />
              )}
              {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </button>
  );

  const getStatusBadge = (status) => {
    const styles = {
      payee: 'bg-green-100 text-green-800',
      partiellement_payee: 'bg-orange-100 text-orange-800',
      en_attente: 'bg-yellow-100 text-yellow-800',
      impayee: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      payee: 'Payée',
      partiellement_payee: 'Partiellement payée',
      en_attente: 'En attente',
      impayee: 'Impayée'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
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
        
        {/* Sélecteur de période */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Période:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="week">Dernière semaine</option>
            <option value="month">Dernier mois</option>
            <option value="year">Dernière année</option>
          </select>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {getStatCard(
          "Total Factures",
          stats.totalInvoices,
          <FileText className="w-6 h-6 text-blue-600" />,
          "bg-blue-100",
          null,
          () => navigate('/facturation/factures')
        )}
        
        {getStatCard(
          "Factures Payées",
          stats.paidInvoices,
          <CheckCircle className="w-6 h-6 text-green-600" />,
          "bg-green-100",
          null,
          () => navigate('/facturation/factures?status=payee')
        )}
        
        {getStatCard(
          "En Attente",
          stats.pendingInvoices,
          <Clock className="w-6 h-6 text-yellow-600" />,
          "bg-yellow-100",
          null,
          () => navigate('/facturation/factures?status=en_attente')
        )}
        
        {getStatCard(
          "Impayées",
          stats.unpaidInvoices,
          <AlertCircle className="w-6 h-6 text-red-600" />,
          "bg-red-100",
          null,
          () => navigate('/facturation/factures?status=impayee')
        )}
      </div>

      {/* Statistiques financières */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Répartition des statuts</h2>
                <p className="text-sm text-gray-600">Synthèse rapide des factures</p>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusSeries.filter(s => s.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {statusSeries.filter(s => s.value > 0).map((entry, index) => (
                      <Cell key={`cell-${entry.key}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {statusSeries.map((s, idx) => (
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Priorité relances</h2>
                <p className="text-sm text-gray-600">Aging des restes à encaisser</p>
              </div>
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
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${b.ratio}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="space-y-6">

          {getStatCard(
            "Total facturé",
            formatCfa(kpis.billed),
            <Coins className="w-6 h-6 text-green-600" />,
            "bg-green-100",
            null,
            () => navigate('/reports')
          )}
          
          {getStatCard(
            "Encaissements",
            formatCfa(kpis.collected),
            <Clock className="w-6 h-6 text-yellow-600" />,
            "bg-yellow-100",
            null,
            () => navigate('/facturation/factures?status=payee')
          )}
          
          {getStatCard(
            "Reste à encaisser",
            formatCfa(kpis.remaining),
            <AlertCircle className="w-6 h-6 text-red-600" />,
            "bg-red-100",
            null,
            () => navigate('/facturation/factures?status=outstanding')
          )}

          {getStatCard(
            "Taux de recouvrement",
            `${kpis.collectionRate}%`,
            <TrendingUp className="w-6 h-6 text-purple-600" />,
            "bg-purple-100",
            null,
            () => navigate('/reports')
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Top restes à encaisser</h2>
                <p className="text-sm text-gray-600">Patients à relancer (période)</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/facturation/factures?status=outstanding')}
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
          <button
            type="button"
            onClick={() => navigate('/facturation/factures?new=1')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Créer une facture</div>
                <div className="text-xs text-gray-600 mt-1">Nouvelle facturation patient</div>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <FileText className="w-5 h-5 text-purple-700" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/facturation/factures?status=outstanding')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Relances impayés</div>
                <div className="text-xs text-gray-600 mt-1">Suivre les montants dus</div>
              </div>
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-700" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/facturation/factures?status=partiellement_payee')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Paiements partiels</div>
                <div className="text-xs text-gray-600 mt-1">Compléter les règlements</div>
              </div>
              <div className="p-2 rounded-full bg-orange-100">
                <Clock className="w-5 h-5 text-orange-700" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/facturation/factures?status=en_attente')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">En attente</div>
                <div className="text-xs text-gray-600 mt-1">Valider et encaisser</div>
              </div>
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="w-5 h-5 text-yellow-700" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Rapports</div>
                <div className="text-xs text-gray-600 mt-1">Synthèses et exports</div>
              </div>
              <div className="p-2 rounded-full bg-gray-100">
                <TrendingUp className="w-5 h-5 text-gray-700" />
              </div>
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
              <div className="p-2 rounded-full bg-blue-100">
                <FileText className="w-5 h-5 text-blue-700" />
              </div>
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
                <option value="payee">Payée</option>
                <option value="partiellement_payee">Partiellement payée</option>
                <option value="en_attente">En attente</option>
                <option value="impayee">Impayée</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecentInvoices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    Aucune facture récente
                  </td>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCfa(invoice.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.statut_paiement)}
                    </td>
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
