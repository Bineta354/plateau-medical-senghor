import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarresVerticalesChart,
  AireCourbeChart,
  DonutEffectifsChart,
} from '../../components/charts';
import {
  Users,
  Stethoscope,
  UserCheck,
  Calculator,
  Shield,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wallet,
  ShieldAlert,
  BarChart3,
  Archive,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES, isCaissierRole } from '../../utils/permissions';
import KpiCard from '../../components/common/KpiCard';
import { formatMontant } from '../../utils/currency';
import {
  computeQueueStats,
  isOnWaitingBench,
  isUrgentQueuePriority,
} from '../../utils/waitingQueueStatus';
import { getTotauxCaisse } from '../../services/paiementService';
import { getAlertes as getSessionsOuvertes } from '../../services/sessionCaisseService';

const sumRestant = (rows) =>
  (rows || []).reduce(
    (sum, f) =>
      sum + parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0))),
    0
  );

const AdminDashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState({
    doctors: 0,
    secretaries: 0,
    accounting: 0,
    cashiers: 0,
    admins: 0,
    active: 0,
    inactive: 0,
    total: 0,
  });
  const [activite, setActivite] = useState({
    totalRDV: 0,
    salleAttente: 0,
    urgenceEnAttente: 0,
    termine: 0,
  });
  const [finance, setFinance] = useState({
    encaissementsJour: 0,
    impayes: 0,
    caissesOuvertes: 0,
  });
  const [activeGroup, setActiveGroup] = useState('effectifs');
  const [evolution, setEvolution] = useState([]);
  const [consultationsEvolution, setConsultationsEvolution] = useState([]);

  useEffect(() => {
    const tenantId = userProfile?.tenant_id;

    const charger = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();

        const semaineStart = new Date(todayStart);
        semaineStart.setDate(semaineStart.getDate() - 6);

        let usersQuery = supabase.from('users').select('role, actif');
        if (tenantId) usersQuery = usersQuery.eq('tenant_id', tenantId);

        const [
          { data: users, error: usersError },
          { data: queueData, error: queueError },
          { count: finishedCount, error: finishedError },
          { data: patientImpayes, error: impayesError1 },
          { data: couvertureImpayes, error: impayesError2 },
          { data: paiementsSemaine, error: semaineError },
          { data: consultationsSemaine, error: consultationsSemaineError },
          totaux,
          sessionsOuvertes,
        ] = await Promise.all([
          usersQuery,
          supabase
            .from('waiting_queue')
            .select('*, appointments(date_heure, statut_arrivee)')
            .gte('appointments.date_heure', todayStart)
            .lt('appointments.date_heure', tomorrowStart)
            .eq('appointments.statut_arrivee', 'arrive')
            .in('status', [
              'waiting', 'en_attente', 'present', 'arrive', 'authorized',
              'called', 'appele', 'en_route', 'medecin_pret', 'in_consultation', 'en_consultation',
            ]),
          supabase
            .from('consultations')
            .select('id', { count: 'exact', head: true })
            .gte('date_consultation', todayStart)
            .lt('date_consultation', tomorrowStart)
            .in('statut', ['terminee', 'termine', 'finished', 'completed']),
          supabase
            .from('factures')
            .select('montant_restant, montant_ttc, montant_paye')
            .is('facture_parent_id', null)
            .in('statut_paiement', ['en_attente', 'partiel']),
          supabase
            .from('factures')
            .select('montant_restant, montant_ttc, montant_paye')
            .eq('type', 'couverture')
            .neq('statut_paiement', 'paye'),
          supabase
            .from('paiements')
            .select('montant, date_paiement')
            .eq('statut', 'effectue')
            .gte('date_paiement', semaineStart.toISOString())
            .lt('date_paiement', tomorrowStart),
          supabase
            .from('consultations')
            .select('date_consultation')
            .gte('date_consultation', semaineStart.toISOString())
            .lt('date_consultation', tomorrowStart)
            .in('statut', ['terminee', 'termine', 'finished', 'completed']),
          getTotauxCaisse(),
          getSessionsOuvertes(),
        ]);

        if (usersError) throw usersError;
        if (queueError) throw queueError;
        if (finishedError) throw finishedError;
        if (impayesError1) throw impayesError1;
        if (impayesError2) throw impayesError2;
        if (semaineError) throw semaineError;
        if (consultationsSemaineError) throw consultationsSemaineError;

        setStaff({
          doctors: (users || []).filter((u) => u.role === ROLES.DOCTOR).length,
          secretaries: (users || []).filter((u) => u.role === ROLES.SECRETARY).length,
          accounting: (users || []).filter((u) => u.role === ROLES.ACCOUNTING).length,
          cashiers: (users || []).filter((u) => isCaissierRole(u.role)).length,
          admins: (users || []).filter((u) => u.role === ROLES.ADMIN).length,
          active: (users || []).filter((u) => u.actif).length,
          inactive: (users || []).filter((u) => !u.actif).length,
          total: (users || []).length,
        });

        const queue = Array.isArray(queueData) ? queueData : [];
        const queueStats = computeQueueStats(queue);
        const urgenceEnAttente = queue.filter(
          (q) => isOnWaitingBench(q.status) && isUrgentQueuePriority(q.priority)
        ).length;
        const termine = finishedCount ?? 0;

        setActivite({
          totalRDV: queueStats.onBench + queueStats.inConsultation + termine,
          salleAttente: queueStats.onBench,
          urgenceEnAttente,
          termine,
        });

        setFinance({
          encaissementsJour: totaux.totalAujourdhui,
          impayes: sumRestant(patientImpayes) + sumRestant(couvertureImpayes),
          caissesOuvertes: (sessionsOuvertes || []).length,
        });

        const joursSemaine = Array.from({ length: 7 }, (_, i) => {
          const jour = new Date(semaineStart);
          jour.setDate(jour.getDate() + i);
          return jour;
        });
        setEvolution(
          joursSemaine.map((jour) => {
            const jourStr = jour.toISOString().slice(0, 10);
            const total = (paiementsSemaine || [])
              .filter((p) => (p.date_paiement || '').slice(0, 10) === jourStr)
              .reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
            return {
              name: jour.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
              value: total,
            };
          })
        );
        setConsultationsEvolution(
          joursSemaine.map((jour) => {
            const jourStr = jour.toISOString().slice(0, 10);
            const count = (consultationsSemaine || []).filter(
              (c) => (c.date_consultation || '').slice(0, 10) === jourStr
            ).length;
            return {
              name: jour.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
              value: count,
            };
          })
        );
      } catch (err) {
        console.error('Erreur lors du chargement du dashboard admin:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    charger();
  }, [userProfile?.tenant_id]);

  const kpiGroups = [
    {
      id: 'effectifs',
      label: 'Effectifs',
      cards: [
        {
          icon: Stethoscope,
          tone: 'blue',
          label: 'Médecins',
          value: staff.doctors,
          onClick: () => navigate('/administration/gestion-medecins'),
        },
        {
          icon: UserCheck,
          tone: 'purple',
          label: 'Secrétaires',
          value: staff.secretaries,
          onClick: () => navigate('/administration/gestion-utilisateurs'),
        },
        {
          icon: Calculator,
          tone: 'yellow',
          label: 'Comptables & Caissiers',
          value: staff.accounting + staff.cashiers,
          onClick: () => navigate('/administration/gestion-caissiers'),
        },
        {
          icon: Shield,
          tone: 'gray',
          label: 'Administrateurs',
          value: staff.admins,
          onClick: () => navigate('/administration/gestion-utilisateurs'),
        },
        {
          icon: Users,
          tone: 'green',
          label: 'Comptes actifs',
          value: `${staff.active} / ${staff.total}`,
          hint: staff.inactive > 0 ? `${staff.inactive} désactivé(s)` : undefined,
          onClick: () => navigate('/administration/gestion-utilisateurs'),
        },
      ],
    },
    {
      id: 'activite',
      label: 'Activité du jour',
      cards: [
        { icon: Calendar, tone: 'blue', label: 'Total RDV', value: activite.totalRDV },
        { icon: Clock, tone: 'yellow', label: "Salle d'attente", value: activite.salleAttente },
        { icon: AlertTriangle, tone: 'red', label: 'Urgence en attente', value: activite.urgenceEnAttente },
        { icon: CheckCircle, tone: 'green', label: 'Terminé', value: activite.termine },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      cards: [
        {
          icon: Wallet,
          tone: 'green',
          label: 'Encaissements du jour',
          value: formatMontant(finance.encaissementsJour),
          onClick: () => navigate('/accounting'),
        },
        {
          icon: AlertTriangle,
          tone: 'red',
          label: 'Impayés en cours',
          value: formatMontant(finance.impayes),
          onClick: () => navigate('/comptabilite/impayes'),
        },
        {
          icon: ShieldAlert,
          tone: finance.caissesOuvertes > 0 ? 'yellow' : 'gray',
          label: 'Caisses non clôturées',
          value: finance.caissesOuvertes,
          hint: finance.caissesOuvertes > 0 ? 'À clôturer en fin de journée' : 'Toutes les caisses sont clôturées',
          onClick: () => navigate('/comptabilite/suivi-caissiers'),
        },
      ],
    },
  ];
  const currentGroup = kpiGroups.find((group) => group.id === activeGroup) || kpiGroups[0];

  const effectifsSeries = [
    { key: 'doctors', name: 'Médecins', value: staff.doctors, color: '#2563eb', from: '#93c5fd', to: '#1d4ed8' },
    { key: 'secretaries', name: 'Secrétaires', value: staff.secretaries, color: '#9333ea', from: '#d8b4fe', to: '#7c3aed' },
    { key: 'comptables', name: 'Comptables & Caissiers', value: staff.accounting + staff.cashiers, color: '#d97706', from: '#fdba74', to: '#c2410c' },
    { key: 'admins', name: 'Administrateurs', value: staff.admins, color: '#4b5563', from: '#d1d5db', to: '#4b5563' },
  ].filter((s) => s.value > 0);

  const encaissementsData = evolution.map((jour) => ({ label: jour.name, value: jour.value }));
  const consultationsData = consultationsEvolution.map((jour) => ({ label: jour.name, value: jour.value }));

  const raccourcis = [
    { label: 'Utilisateurs', icon: Users, path: '/administration/gestion-utilisateurs' },
    { label: 'Médecins', icon: Stethoscope, path: '/administration/gestion-medecins' },
    { label: 'Caissiers', icon: Calculator, path: '/administration/gestion-caissiers' },
    { label: 'Sécurité', icon: Shield, path: '/security' },
    { label: 'Statistiques', icon: BarChart3, path: '/statistics' },
    { label: 'Historiques & Archives', icon: Archive, path: '/historiques-archives' },
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">Erreur lors du chargement des données : {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord administrateur</h1>
        <p className="text-gray-600 mt-1">
          Vue d'ensemble du cabinet — effectifs, activité du jour et situation financière.
        </p>
      </div>

      {/* Indicateurs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Indicateurs</h2>
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
            {kpiGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={activeGroup === group.id}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeGroup === group.id
                    ? 'bg-white text-medical-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {currentGroup.cards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <KpiCard {...card} loading={loading} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Finance, effectifs, graphiques & accès rapides */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {loading ? (
              <div className="h-40 bg-gray-100 rounded-[20px] animate-pulse" />
            ) : (
              <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">Finance</p>
                  <button
                    type="button"
                    onClick={() => navigate('/caissier/recapitulatif')}
                    className="text-sm font-semibold text-medical-primary hover:underline"
                  >
                    Récapitulatif →
                  </button>
                </div>
                <div className="flex items-end gap-8 mb-4">
                  <div>
                    <p className="m-0 text-2xl font-bold text-green-600">{formatMontant(finance.encaissementsJour)}</p>
                    <p className="mt-1 mb-0 text-xs text-gray-500">encaissé aujourd'hui</p>
                  </div>
                  <div>
                    <p className="m-0 text-2xl font-bold text-orange-600">{formatMontant(finance.impayes)}</p>
                    <p className="mt-1 mb-0 text-xs text-gray-500">impayés en cours</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-600"
                    style={{
                      width: `${
                        finance.encaissementsJour + finance.impayes > 0
                          ? Math.round(
                              (finance.encaissementsJour / (finance.encaissementsJour + finance.impayes)) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {finance.caissesOuvertes > 0 && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-50 text-amber-700 text-sm">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    {finance.caissesOuvertes} caisse{finance.caissesOuvertes > 1 ? 's' : ''} non clôturée
                    {finance.caissesOuvertes > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="h-64 bg-gray-100 rounded-[20px] animate-pulse" />
            ) : (
              <BarresVerticalesChart
                title="Encaissements — 7 derniers jours"
                value={evolution.reduce((sum, jour) => sum + jour.value, 0).toLocaleString('fr-FR')}
                unit="FCFA"
                data={encaissementsData}
              />
            )}

            {loading ? (
              <div className="h-64 bg-gray-100 rounded-[20px] animate-pulse" />
            ) : (
              <AireCourbeChart title="Consultations terminées — 7 derniers jours" data={consultationsData} />
            )}
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="h-64 bg-gray-100 rounded-[20px] animate-pulse" />
            ) : (
              <DonutEffectifsChart
                title="Effectifs"
                data={effectifsSeries}
                headerRight={`${staff.total} comptes`}
                footer={
                  staff.inactive > 0
                    ? `${staff.inactive} compte${staff.inactive > 1 ? 's' : ''} inactif${staff.inactive > 1 ? 's' : ''} sur ${staff.total}`
                    : undefined
                }
              />
            )}

            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
              <p className="m-0 mb-3 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">
                Accès rapides
              </p>
              <div className="flex flex-col gap-1">
                {raccourcis.map(({ label, icon: Icon, path }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <Icon className="w-[18px] h-[18px] text-medical-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
