import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Bell,
  Eye,
  Calendar,
  CalendarPlus,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import GlobalWaitingQueue from './GlobalWaitingQueue';
import DoctorSpecificQueue from './DoctorSpecificQueue';
import CustomCalendar from '../CustomCalendar';
import { NewAppointmentModal } from '../rendez-vous/NewAppointmentModal';
import { getUnreadNotifications, subscribeToNotifications, unsubscribeFromNotifications } from '../../lib/notifications';
import useUserProfile from '../../hooks/useUserProfile';
import { useSpecialityConfig } from '../../contexts/SpecialityConfigContext';

const SecretaryDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { profile: userProfile, isLoading: userProfileLoading } = useUserProfile();
  const [activeView, setActiveView] = useState('global'); // 'global' ou 'specific'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const { specialityConfig } = useSpecialityConfig();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [doctorQueueFilter, setDoctorQueueFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  // Bascule "Calendrier" (action rapide dans la zone haute) — bascule le contenu
  // de la card entre file d'attente et calendrier.
  const [showCalendarView, setShowCalendarView] = useState(false);
  // Modal "Nouveau rendez-vous" — ouvert en place, sans quitter le dashboard
  // (composant autonome, voir components/rendez-vous/NewAppointmentModal.jsx)
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [notificationSubscription, setNotificationSubscription] = useState(null);

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchDoctors().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userProfile?.tenant_id]);

  useEffect(() => {
    // Abonnement aux changements de la file d'attente
    const waitingQueueChannel = supabase.channel('secretary_dashboard_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waiting_queue'
      }, () => {
        fetchData();
      })
      .subscribe();

    if (userProfile?.id && userProfile?.role) {
      fetchNotifications();
      const { subscription, unsubscribe } = subscribeToNotifications(userProfile.id, userProfile.role, () => {
        fetchNotifications();
      });

      setNotificationSubscription({ subscription, unsubscribe });

      return () => {
        supabase.removeChannel(waitingQueueChannel);
        if (notificationSubscription?.unsubscribe) {
          notificationSubscription.unsubscribe();
        }
      };
    }

    return () => {
      supabase.removeChannel(waitingQueueChannel);
    };
  }, [userProfile?.id, userProfile?.role]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchDoctors(),
        fetchNotifications()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'doctor')
        .eq('actif', true)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('nom', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!userProfile?.id || !userProfile?.role) {
        console.log('⚠️ [SecretaryDashboard] Profil utilisateur non disponible');
        return;
      }
      const data = await getUnreadNotifications(userProfile.id, userProfile.role);
      setNotifications(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
      setNotifications([]);
    }
  };

  const handleDoctorSelect = (doctor, queueFilter = 'all') => {
    if (!doctor) {
      setSelectedDoctor(null);
      setDoctorQueueFilter('all');
      setActiveView('global');
      return;
    }
    setSelectedDoctor(doctor);
    setDoctorQueueFilter(queueFilter);
    setActiveView('specific');
  };

  const handleBackToGlobal = () => {
    setSelectedDoctor(null);
    setActiveView('global');
  };

  if (loading || userProfileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Zone haute : titre + une seule ligne d'actions (cf. AUDIT_STRUCTURE_UI.md) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Secrétaire</h1>
          {specialityConfig && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {specialityConfig.mode === 'generaliste'
                ? 'Généraliste'
                : specialityConfig.specialite?.nom || 'Spécialité'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-500" title="Notifications non lues">
            <Bell className="w-4 h-4" />
            {notifications.length}
          </div>
          <button
            onClick={() => navigate('/rendez-vous/prise-rendez-vous')}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <UserCheck className="w-4 h-4" />
            Arriver Patient
          </button>
          <button
            onClick={() => setShowNewAppointmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-medical-primary text-white text-sm font-medium rounded-lg hover:bg-medical-primary-dark transition-colors shadow-sm"
          >
            <CalendarPlus className="w-4 h-4" />
            Nouveau rendez-vous
          </button>
          <button
            onClick={() => navigate('/patients?new=true')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-medical-primary border border-medical-primary text-sm font-medium rounded-lg hover:bg-medical-primary/5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Créer fiche patient
          </button>
          {/* Action rapide : bascule vers le calendrier, pas un onglet dans le contenu */}
          <button
            onClick={() => setShowCalendarView(!showCalendarView)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
              showCalendarView
                ? 'bg-gray-700 text-white hover:bg-gray-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {showCalendarView ? "Voir file d'attente" : 'Calendrier'}
          </button>
          <button
            onClick={fetchData}
            title="Actualiser"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card unique : file d'attente (par défaut) ou calendrier selon l'action
          rapide "Calendrier" ci-dessus */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {showCalendarView ? (
          <div className="p-4">
            <CustomCalendar />
          </div>
        ) : (
          <>
            {/* Barre d'outils compacte : vue globale/spécifique, recherche, filtre */}
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  onClick={() => setActiveView('global')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'global'
                      ? 'bg-white text-medical-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Globale
                </button>
                <button
                  onClick={() => setActiveView('specific')}
                  disabled={!selectedDoctor}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'specific'
                      ? 'bg-white text-medical-primary shadow-sm'
                      : selectedDoctor
                        ? 'text-gray-500 hover:text-gray-700'
                        : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Spécifique
                </button>
              </div>

              {activeView === 'specific' && selectedDoctor && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                  Dr. {selectedDoctor.prenom} {selectedDoctor.nom}
                  <button
                    onClick={handleBackToGlobal}
                    className="hover:text-blue-900"
                    title="Retour à la vue globale"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un médecin ou un patient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="waiting">En attente</option>
                  <option value="appele">Appelé</option>
                  <option value="entre">Entré</option>
                  <option value="in_consultation">En consultation</option>
                  <option value="urgent">Urgences</option>
                  <option value="finished">Terminé</option>
                </select>
              </div>
            </div>

            <div className="p-4">
              {activeView === 'global' ? (
                <GlobalWaitingQueue
                  doctors={doctors}
                  searchTerm={searchTerm}
                  filterStatus={filterStatus}
                  onFilterStatus={setFilterStatus}
                  onDoctorSelect={handleDoctorSelect}
                  onNavigateCalendar={() => navigate('/secretary-calendar')}
                  onNavigateWaitingRoom={() => navigate('/salle-attente')}
                />
              ) : (
                <DoctorSpecificQueue
                  doctor={selectedDoctor}
                  searchTerm={searchTerm}
                  filterStatus={filterStatus}
                  initialQueueFilter={doctorQueueFilter}
                />
              )}
            </div>
          </>
        )}
      </div>

      <NewAppointmentModal
        isOpen={showNewAppointmentModal}
        onClose={() => setShowNewAppointmentModal(false)}
        initialDoctorId={activeView === 'specific' ? (selectedDoctor?.id || '') : ''}
        onSaved={fetchData}
      />
    </div>
  );
};

export default SecretaryDashboard;
