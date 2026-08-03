console.log('📦 [SalleAttentePage.jsx] Fichier chargé');

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Clock,
  User,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  RefreshCw,
  Eye,
  Edit,
  UserCheck,
  Stethoscope,
  Timer,
  Activity,
  MapPin,
  Heart,
  Thermometer,
  FileImage,
  Upload,
  ClipboardList
} from 'lucide-react';
import { formatDoctorSpecialties, getDoctorInitials } from '../utils/doctorUtils';
import PatientDocumentUploader from '../components/secretary/PatientDocumentUploader';
import PatientAntecedentsModal from '../components/secretary/PatientAntecedentsModal';
import {
  WAITING_QUEUE_ACTIVE_STATUSES,
  computeQueueStats,
  filterActiveQueueItems,
  isStrictlyWaitingStatus,
  isPresentInQueueStatus,
  isCalledInQueueStatus,
  isInConsultationQueueStatus,
  isTerminalQueueStatus,
  hasPastAppointment,
  filterOutPastAppointments,
  isStuckInConsultation,
  filterOutStuckConsultations,
  isActiveQueueStatus,
} from '../utils/waitingQueueStatus';
import {
  validateQueueTransition,
} from '../utils/workflowGuards';
import { sendNotification, NOTIFICATION_TYPES } from '../lib/notifications';

const SalleAttentePage = () => {
  console.log('🚀 [SalleAttente] Composant rendu - DÉBUT');

  const { currentUser, userProfile } = useAuth();
  console.log('👤 [SalleAttente] Auth hook exécuté:', { currentUser, userProfile });

  const [patientsEnAttente, setPatientsEnAttente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [patientReadyNotifications, setPatientReadyNotifications] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState(null);
  const [selectedPatientForAntecedents, setSelectedPatientForAntecedents] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!userProfile?.tenant_id) {
      console.log('⏳ [SalleAttente] En attente du profil utilisateur...');
      return;
    }

    console.log('✅ [SalleAttente] Profil chargé, initialisation...');
    fetchPatientsEnAttente();
    setupRealtimeSubscription();
    fetchPatientReadyNotifications();

    // Actualisation automatique toutes les 30 secondes
    const interval = setInterval(fetchPatientsEnAttente, 30000);
    return () => clearInterval(interval);
  }, [userProfile?.tenant_id]);

  // Gestion du redimensionnement du panneau
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 500) {
          setLeftPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const setupRealtimeSubscription = () => {
    if (!userProfile?.tenant_id) {
      console.warn('⚠️ [SalleAttente] Impossible de configurer Realtime: tenant_id non disponible');
      return () => {};
    }

    try {
      const channel = supabase.channel('salle_attente_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'waiting_queue',
          filter: `tenant_id=eq.${userProfile?.tenant_id}`
        }, (payload) => {
          console.log('🔄 [SalleAttente] Changement temps réel détecté (waiting_queue):', payload);
          fetchPatientsEnAttente();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications_medecin_secretaire',
          filter: `tenant_id=eq.${userProfile?.tenant_id}`
        }, (payload) => {
          console.log('🔄 [SalleAttente] Changement notification détecté:', payload);
          fetchPatientReadyNotifications();
        })
        .subscribe((status) => {
          console.log('📡 [SalleAttente] Realtime subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('❌ [SalleAttente] Erreur lors de la configuration Realtime:', error);
      return () => {};
    }
  };

  const fetchPatientReadyNotifications = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications_medecin_secretaire')
        .select('*')
        .eq('type_notification', 'patient_ready')
        .eq('lu', false)
        .eq('tenant_id', userProfile?.tenant_id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      const notifications = Array.isArray(notificationsData) ? notificationsData : [];
      console.log('🔔 [SalleAttente] Notifications patient_ready récupérées:', notifications.length);
      console.log('🔔 [SalleAttente] Tenant ID pour notifications:', userProfile?.tenant_id);
      setPatientReadyNotifications(notifications);
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
    }
  };

  const fetchPatientsEnAttente = async () => {
    try {
      console.log('🔄 [SalleAttente] Récupération des patients en attente...');
      console.log('👤 [SalleAttente] User profile:', userProfile);

      if (!userProfile?.tenant_id) {
        console.warn('⚠️ [SalleAttente] Cabinet ID non disponible dans le profil utilisateur');
        setPatientsEnAttente([]);
        return;
      }

      // Calculer les bornes de la date d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      // 1) Patients en file d'attente avec rendez-vous aujourd'hui et présence confirmée
      // Filtrer pour n'afficher que les patients réellement en attente (pas déjà en consultation)
      const { data: queueData, error: queueError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointments!inner(date_heure, statut_arrivee, heure_arrivee, statut)
        `)
        .not('appointment_id', 'is', null)
        .gte('created_at', todayStart)
        .lt('created_at', tomorrowStart)
        .gte('appointments.date_heure', todayStart)
        .lt('appointments.date_heure', tomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive')
        .not('appointments.statut', 'in', '("termine", "annule", "reporte", "absent", "cancelled")')
        .in('status', ['waiting', 'en_attente', 'present', 'arrive', 'authorized', 'called', 'appele', 'en_route', 'medecin_pret'])
        .eq('tenant_id', userProfile?.tenant_id)
        .order('order_position', { ascending: true });

      if (queueError) {
        console.error('❌ [SalleAttente] Erreur lors de la récupération de la file d\'attente:', queueError);
        throw queueError;
      }

      const list = Array.isArray(queueData) ? queueData : [];
      console.log('📊 [SalleAttente] Données brutes récupérées:', list.length, 'entrées');
      console.log('📊 [SalleAttente] Tenant ID:', userProfile?.tenant_id);
      console.log('📊 [SalleAttente] Statuts présents:', [...new Set(list.map(i => i.status))]);
      console.log('📊 [SalleAttente] Statuts arrivee des rendez-vous:', [...new Set(list.map(i => i.appointments?.statut_arrivee))]);
      console.log('📊 [SalleAttente] WAITING_QUEUE_ACTIVE_STATUSES:', WAITING_QUEUE_ACTIVE_STATUSES);

      // Log pour débogage: vérifier s'il y a des entrées sans appointment_id ou avec statut_arrivee != 'arrive'
      const { data: allQueueData, error: allQueueError } = await supabase
        .from('waiting_queue')
        .select('id, patient_id, medecin_id, appointment_id, status, created_at, tenant_id')
        .gte('created_at', todayStart)
        .lt('created_at', tomorrowStart)
        .eq('tenant_id', userProfile?.tenant_id);

      if (!allQueueError && allQueueData) {
        const withoutAppointment = allQueueData.filter(q => !q.appointment_id);
        const withInvalidStatus = allQueueData.filter(q => q.appointment_id); // On ne peut pas vérifier statut_arrivee sans join
        console.log('🔍 [SalleAttente] Entrées sans appointment_id:', withoutAppointment.length);
        console.log('🔍 [SalleAttente] Total entrées waiting_queue aujourd\'hui:', allQueueData.length);
      }
      
      if (list.length === 0) {
        setPatientsEnAttente([]);
        return;
      }

      // Déduplication améliorée: garder la plus récente par patient_id ET medecin_id
      const pickTimestamp = (it) => new Date(it.arrived_at || it.updated_at || it.created_at || 0).getTime();
      const uniqueMap = new Map();
      for (const it of list) {
        // Utiliser une clé unique basée sur patient_id et medecin_id pour éviter les doublons
        const key = `${it.patient_id}-${it.medecin_id}`;
        const prev = uniqueMap.get(key);
        if (!prev || pickTimestamp(it) > pickTimestamp(prev)) {
          uniqueMap.set(key, it);
        }
      }
      const deduped = Array.from(uniqueMap.values());

      // 2) Récupérer en masse les patients et médecins référencés
      const patientIds = Array.from(new Set(deduped.map(i => i.patient_id).filter(Boolean)));
      const doctorIds = Array.from(new Set(deduped.map(i => i.medecin_id).filter(Boolean)));

      let patientMap = {};
      let doctorMap = {};

      if (patientIds.length > 0) {
        const { data: patientsRows, error: patientsErr } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, date_naissance')
          .in('id', patientIds);
        if (!patientsErr && patientsRows) {
          patientMap = Object.fromEntries(patientsRows.map(p => [p.id, p]));
        } else {
          console.error('SalleAttente: erreur récupération patients', patientsErr);
          // Créer des entrées par défaut pour éviter les noms manquants
          patientIds.forEach(id => {
            patientMap[id] = { id, nom: 'Inconnu', prenom: 'Patient', telephone: 'N/A' };
          });
        }
      }

      if (doctorIds.length > 0) {
        const { data: doctorsRows, error: doctorsErr } = await supabase
          .from('users')
          .select('id, nom, prenom, specialite')
          .in('id', doctorIds);
        if (!doctorsErr && doctorsRows) {
          doctorMap = Object.fromEntries(doctorsRows.map(d => [d.id, d]));
        } else {
          console.error('SalleAttente: erreur récupération médecins', doctorsErr);
          // Créer des entrées par défaut pour éviter les noms manquants
          doctorIds.forEach(id => {
            doctorMap[id] = { id, nom: 'Inconnu', prenom: 'Dr.', specialite: 'N/A' };
          });
        }
      }

      // 3) Fusionner les données pour correspondre au rendu actuel
      const enriched = deduped.map(item => ({
        ...item,
        patient: patientMap[item.patient_id] || { id: item.patient_id, nom: 'Inconnu', prenom: 'Patient', telephone: 'N/A' },
        medecin: doctorMap[item.medecin_id] || { id: item.medecin_id, nom: 'Inconnu', prenom: 'Dr.', specialite: 'N/A' },
      }));

      // 4) Filtrer client-side pour garantir que seuls les patients créés aujourd'hui sont affichés
      const finalFilteredItems = enriched.filter(item => {
        const createdAt = new Date(item.created_at);
        const itemDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isToday = itemDate.getTime() === todayDate.getTime();
        const isActive = isActiveQueueStatus(item.status);
        if (!isActive) {
          console.log('⚠️ [SalleAttente] Patient filtré (statut inactif):', {
            patient_id: item.patient_id,
            status: item.status,
            patient_name: item.patient?.prenom + ' ' + item.patient?.nom
          });
        }
        return isToday && isActive;
      });

      console.log('✅ [SalleAttente] Patients après filtre final:', finalFilteredItems.length, 'patients');
      console.log('📊 [SalleAttente] Statuts après filtre:', [...new Set(finalFilteredItems.map(i => i.status))]);
      setPatientsEnAttente(finalFilteredItems);
    } catch (error) {
      console.error('Erreur lors du chargement des patients en attente:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePatientStatus = async (patientId, newStatus) => {
    try {
      const currentPatient = patientsEnAttente.find(p => p.id === patientId);
      if (!currentPatient) {
        addNotification('Patient non trouvé', 'error');
        return;
      }

      const transition = validateQueueTransition(currentPatient.status, newStatus);
      if (transition.needsConfirmation && !confirmSkippedWorkflowSteps(transition.skippedSteps, 'changer le statut')) {
        return;
      }

      const { error } = await supabase
        .from('waiting_queue')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) throw error;

      // Ajouter une notification
      addNotification(`Patient ${newStatus === 'in_consultation' ? 'en consultation' : 'appelé'}`, 'success');
      fetchPatientsEnAttente();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du status:', error);
      addNotification('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleSendToDoctor = async (patientId) => {
    try {
      const currentPatient = patientsEnAttente.find(p => p.id === patientId);
      if (!currentPatient) {
        addNotification('Patient non trouvé', 'error');
        return;
      }

      // Mettre à jour le statut en 'en_route'
      const { error } = await supabase
        .from('waiting_queue')
        .update({
          status: 'en_route',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) throw error;

      // Envoyer notification au médecin
      const patientName = `${currentPatient.patient?.prenom} ${currentPatient.patient?.nom}`;
      const medecinId = currentPatient.medecin_id;

      try {
        await sendNotification(
          NOTIFICATION_TYPES.PATIENT_ON_WAY,
          currentUser.id,
          medecinId,
          null,
          patientName,
          {
            waitingQueueId: patientId,
            patientId: currentPatient.patient_id
          }
        );
      } catch (nerr) {
        console.warn('Envoi notification médecin échoué (non bloquant):', nerr);
      }

      addNotification(`Patient envoyé au médecin avec succès`, 'success');
      fetchPatientsEnAttente();
    } catch (error) {
      console.error('Erreur lors de l\'envoi au médecin:', error);
      addNotification('Erreur lors de l\'envoi au médecin', 'error');
    }
  };

  const handleConfirmPatientIntroduction = async (notification) => {
    try {
      const waitingQueueId = notification.waiting_queue_id;
      if (!waitingQueueId) {
        console.error('ID de file d\'attente manquant');
        addNotification('Erreur: ID de file d\'attente manquant', 'error');
        return;
      }

      // Mettre à jour le statut du patient en 'en_route' (patient envoyé au médecin)
      const { error: updateError } = await supabase
        .from('waiting_queue')
        .update({
          status: 'en_route',
          updated_at: new Date().toISOString()
        })
        .eq('id', waitingQueueId);

      if (updateError) throw updateError;

      // Envoyer notification au médecin que le patient est en route
      const patientName = notification.message?.replace(/.*demande à introduire /, '') || 'Patient';
      const medecinId = notification.medecin_id;

      try {
        await sendNotification(
          NOTIFICATION_TYPES.PATIENT_ON_WAY,
          currentUser.id,
          medecinId,
          null,
          patientName,
          {
            waitingQueueId: waitingQueueId,
            patientId: notification.patient_id
          }
        );
      } catch (nerr) {
        console.warn('Envoi notification médecin échoué (non bloquant):', nerr);
      }

      // Marquer la notification comme lue
      await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true, lu_at: new Date().toISOString() })
        .eq('id', notification.id);

      addNotification('Patient envoyé au médecin', 'success');
      setPatientReadyNotifications(prev => prev.filter(n => n.id !== notification.id));
      fetchPatientsEnAttente();
    } catch (error) {
      console.error('Erreur lors de la confirmation:', error);
      addNotification('Erreur lors de la confirmation', 'error');
    }
  };

  const addNotification = (message, type) => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const getStatusBadge = (status, queueItem = null) => {
    // Si le statut est terminal (terminé, absent, etc.), ne pas afficher de badge
    if (isTerminalQueueStatus(status)) {
      return null;
    }

    // Vérifier si le rendez-vous est en retard
    const isOverdue = queueItem && hasPastAppointment(queueItem);

    const statusConfig = {
      waiting: { 
        color: isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800', 
        icon: isOverdue ? AlertTriangle : Clock, 
        label: isOverdue ? 'Retard' : 'En attente' 
      },
      present: { color: 'bg-blue-100 text-blue-800', icon: UserCheck, label: 'Présent' },
      arrive: { color: 'bg-blue-100 text-blue-800', icon: UserCheck, label: 'Arrivé' },
      called: { color: 'bg-orange-100 text-orange-800', icon: Bell, label: 'Appelé' },
      appele: { color: 'bg-orange-100 text-orange-800', icon: Bell, label: 'Appelé' },
      medecin_pret: { color: 'bg-cyan-100 text-cyan-800', icon: CheckCircle, label: 'Médecin prêt' },
      en_route: { color: 'bg-purple-100 text-purple-800', icon: User, label: 'Patient appelé' },
      in_consultation: { color: 'bg-green-100 text-green-800', icon: Stethoscope, label: 'En consultation' }
    };
    
    const config = statusConfig[status] || statusConfig.waiting;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgente': return 'border-l-red-500 bg-red-50';
      case 'tres_urgente': return 'border-l-red-700 bg-red-100';
      default: return 'border-l-blue-500 bg-white';
    }
  };

  const getWaitingTime = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}min`;
    }
  };

  const handlePatientDetails = (patient) => {
    setSelectedPatient(patient);
    setShowPatientDetails(true);
  };

  const queueStats = computeQueueStats(patientsEnAttente);

  const displayedPatients = useMemo(() => {
    if (statusFilter === 'all') return patientsEnAttente;
    if (statusFilter === 'waiting') {
      return patientsEnAttente.filter((p) => isStrictlyWaitingStatus(p.status));
    }
    if (statusFilter === 'present') {
      return patientsEnAttente.filter((p) => isPresentInQueueStatus(p.status));
    }
    if (statusFilter === 'called') {
      return patientsEnAttente.filter((p) => isCalledInQueueStatus(p.status));
    }
    if (statusFilter === 'in_consultation') {
      return patientsEnAttente.filter((p) =>
        isInConsultationQueueStatus(p.status),
      );
    }
    return patientsEnAttente;
  }, [patientsEnAttente, statusFilter]);

  const statCardClass =
    'bg-white rounded-lg shadow-md p-4 border border-gray-200 cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-medical-primary/25';


  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* En-tête compact */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title">Salle d'Attente</h1>
            <p className="text-small">Gestion en temps réel des patients présents</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600">
                {queueStats.inWaitingRoom} patient
                {queueStats.inWaitingRoom > 1 ? 's' : ''} en salle
              </span>
            </div>
            <button 
              onClick={fetchPatientsEnAttente}
              className="flex items-center px-3 py-1.5 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Notifications compact */}
      {notifications.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 space-y-1">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-2 rounded border-l-4 text-xs ${
                notification.type === 'success'
                  ? 'bg-green-50 border-green-500 text-green-800'
                  : 'bg-red-50 border-red-500 text-red-800'
              }`}
            >
              <div className="flex items-center">
                <Bell className="w-3 h-3 mr-1.5" />
                <span className="font-medium">{notification.message}</span>
                <span className="ml-auto text-xs opacity-75">
                  {notification.timestamp ? notification.timestamp.toLocaleTimeString() : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistiques compact */}
      <div className="flex-shrink-0 px-4 py-2 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')}
          className={`text-left p-2 bg-white rounded shadow border border-gray-200 hover:shadow-md transition-all ${statusFilter === 'waiting' ? 'ring-2 ring-yellow-400' : ''}`}
        >
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div className="ml-2">
              <p className="text-stat-label">En attente</p>
              <p className="text-stat-number">{queueStats.waiting}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'called' ? 'all' : 'called')}
          className={`text-left p-2 bg-white rounded shadow border border-gray-200 hover:shadow-md transition-all ${statusFilter === 'called' ? 'ring-2 ring-orange-400' : ''}`}
        >
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-orange-600" />
            <div className="ml-2">
              <p className="text-stat-label">Appelés</p>
              <p className="text-stat-number">{queueStats.called}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(
              statusFilter === 'in_consultation' ? 'all' : 'in_consultation',
            )
          }
          className={`text-left p-2 bg-white rounded shadow border border-gray-200 hover:shadow-md transition-all ${statusFilter === 'in_consultation' ? 'ring-2 ring-green-400' : ''}`}
        >
          <div className="flex items-center">
            <Stethoscope className="w-5 h-5 text-green-600" />
            <div className="ml-2">
              <p className="text-stat-label">En consultation</p>
              <p className="text-stat-number">
                {queueStats.inConsultation}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Section des demandes d'introduction de patients */}
      {patientReadyNotifications.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Bell className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="text-sm font-semibold text-green-900">
                Demandes d'introduction ({patientReadyNotifications.length})
              </h3>
            </div>
            <div className="space-y-2">
              {patientReadyNotifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white p-3 rounded border border-green-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.created_at ? new Date(notification.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleConfirmPatientIntroduction(notification)}
                      className="ml-3 inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirmer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Debug: Afficher si aucune notification n'est trouvée */}
      {patientReadyNotifications.length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 text-center">Aucune demande d'introduction en attente</p>
        </div>
      )}

      {/* Contenu principal avec panneau redimensionnable */}
      <div className="flex-1 flex overflow-hidden px-4 pb-4">
        {/* Panneau latéral redimensionnable */}
        <div 
          style={{ width: `${leftPanelWidth}px`, minWidth: '200px', maxWidth: '500px' }}
          className="flex-shrink-0 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col"
        >
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Filtres</h3>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                >
                  <option value="all">Tous</option>
                  <option value="waiting">En attente</option>
                  <option value="present">Présents</option>
                  <option value="called">Appelés</option>
                  <option value="in_consultation">En consultation</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Handle de redimensionnement */}
        <div
          className="w-1 bg-gray-200 hover:bg-medical-primary cursor-col-resize flex-shrink-0 transition-colors"
          onMouseDown={(e) => {
            setIsResizing(true);
            e.preventDefault();
          }}
        />

        {/* Panneau principal */}
        <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Patients en salle d'attente</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {loading ? (
                // Skeletons pendant le chargement
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="p-3 border-l-4 border-gray-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                          <div className="flex space-x-4">
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                displayedPatients.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`p-3 border-l-4 ${getPriorityColor(item.priorite)} hover:bg-gray-50 transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-medical-primary rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {index + 1}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {item.patient?.prenom} {item.patient?.nom}
                          </h3>
                          {getStatusBadge(item.status, item)}
                        </div>
                        
                        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-600">
                          <div className="flex items-center">
                            <Stethoscope className="w-3 h-3 mr-1" />
                            {formatDoctorSpecialties(item.medecin)}
                          </div>
                          <div className="flex items-center">
                            <Timer className="w-3 h-3 mr-1" />
                            Attente: {getWaitingTime(item.created_at)}
                          </div>
                          <div className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {item.patient?.telephone}
                          </div>
                        </div>
                        
                        {item.motif_consultation && (
                          <div className="mt-1 text-xs text-gray-700">
                            <span className="font-medium">Motif:</span> {item.motif_consultation}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {item.status === 'called' && (
                        <button
                          onClick={() => updatePatientStatus(item.id, 'in_consultation')}
                          className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                        >
                          En consultation
                        </button>
                      )}
                      
                      {(item.status === 'waiting' || item.status === 'en_attente' || item.status === 'present' || item.status === 'arrive' || item.status === 'authorized') && (
                        <button
                          onClick={() => handleSendToDoctor(item.id)}
                          className="inline-flex items-center px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs"
                          title="Envoyer le patient au médecin"
                        >
                          <Stethoscope className="w-3 h-3 mr-1" />
                          Envoyer
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setSelectedPatientForUpload(item.patient);
                          setShowUploadModal(true);
                        }}
                        className="inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                        title="Scanner des documents médicaux"
                      >
                        <FileImage className="w-3 h-3 mr-1" />
                        Scanner
                      </button>

                      <button
                        onClick={() => setSelectedPatientForAntecedents(item.patient)}
                        className="inline-flex items-center px-2 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-xs"
                        title="Saisir les antécédents (ex: carnet de santé apporté par le patient)"
                      >
                        <ClipboardList className="w-3 h-3 mr-1" />
                        Antécédents
                      </button>

                      <button
                        onClick={() => handlePatientDetails(item)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
  
              
              {!loading && patientsEnAttente.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun patient en salle d'attente</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal détails patient */}
      {showPatientDetails && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Détails du patient
                </h3>
                <button
                  onClick={() => setShowPatientDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informations patient */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Informations personnelles
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Nom:</span>
                      <span className="ml-2">{selectedPatient.patient?.prenom} {selectedPatient.patient?.nom}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Téléphone:</span>
                      <span className="ml-2">{selectedPatient.patient?.telephone}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Date de naissance:</span>
                      <span className="ml-2">
                        {selectedPatient.patient?.date_naissance ? 
                          new Date(selectedPatient.patient.date_naissance).toLocaleDateString('fr-FR') : 
                          'Non renseignée'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Consultation
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Spécialité:</span>
                      <span className="ml-2">{formatDoctorSpecialties(selectedPatient.medecin)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Motif:</span>
                      <span className="ml-2">{selectedPatient.motif_consultation || 'Non spécifié'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Status:</span>
                      <span className="ml-2">{getStatusBadge(selectedPatient.status, selectedPatient)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions rapides */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Actions rapides</h4>
                <div className="flex space-x-3">
                  {selectedPatient.status === 'waiting' && (
                    <button
                      onClick={() => {
                        updatePatientStatus(selectedPatient.id, 'called');
                        setShowPatientDetails(false);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Appeler le patient
                    </button>
                  )}
                  
                  {selectedPatient.status === 'called' && (
                    <button
                      onClick={() => {
                        updatePatientStatus(selectedPatient.id, 'in_consultation');
                        setShowPatientDetails(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Démarrer consultation
                    </button>
                  )}
                  
                  <button
                    onClick={() => setShowPatientDetails(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'upload de documents */}
      {showUploadModal && selectedPatientForUpload && (
        <PatientDocumentUploader
          patient={selectedPatientForUpload}
          onUploadSuccess={() => {
            setShowUploadModal(false);
            setSelectedPatientForUpload(null);
            addNotification('Documents uploadés avec succès', 'success');
          }}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedPatientForUpload(null);
          }}
        />
      )}

      {/* Modal des antécédents (saisie par la secrétaire à l'accueil) */}
      {selectedPatientForAntecedents && (
        <PatientAntecedentsModal
          patient={selectedPatientForAntecedents}
          onClose={() => setSelectedPatientForAntecedents(null)}
        />
      )}
    </div>
  );
};

export default SalleAttentePage;
