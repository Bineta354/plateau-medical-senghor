import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification, NOTIFICATION_TYPES, subscribeToNotifications, unsubscribeFromNotifications } from '../lib/notifications';
import { doctorService } from '../services/doctorService';
import {
  confirmSkippedWorkflowSteps,
  validateQueueTransition,
} from '../utils/workflowGuards';
import {
  WAITING_QUEUE_ACTIVE_STATUSES,
  filterActiveQueueItems,
  isStrictlyWaitingStatus,
  isPresentInQueueStatus,
  isCalledInQueueStatus,
  isInConsultationQueueStatus,
  isActiveQueueStatus,
} from '../utils/waitingQueueStatus';
import WebSocketDiagnostic from '../components/WebSocketDiagnostic';
import {
  Clock,
  User,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Play,
  Pause,
  RefreshCw,
  Bell,
  Stethoscope,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  PhoneCall,
  UserCheck,
  UserX,
  Clock3,
  Search,
  Filter
} from 'lucide-react';
import KpiCard from '../components/common/KpiCard';

const MyWaitingQueuePage = () => {
  const { currentUser, getUserProfile } = useAuth();
  const [isActive, setIsActive] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [callCountdown, setCallCountdown] = useState(null);
  const [websocketStatus, setWebsocketStatus] = useState('connecting'); // 'connecting', 'connected', 'error', 'disconnected'
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] = useState(null);

  useEffect(() => {
    fetchData();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userProfile?.id) {
      setupRealtimeSubscription();
      setupNotificationSubscription();
    }
  }, [userProfile]);

  // Gérer le compteur d'appel
  useEffect(() => {
    if (!callCountdown) return;

    const timer = setInterval(() => {
      setCallCountdown(prev => {
        if (!prev || prev.seconds <= 1) {
          return null; // Arrêter le compteur
        }
        return {
          ...prev,
          seconds: prev.seconds - 1
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [callCountdown]);

  // Log des filtres seulement quand la file d'attente change
  useEffect(() => {
    if (waitingQueue.length > 0) {
      console.log('🔍 [MyWaitingQueue] Filtres appliqués:');
      console.log('  - En attente:', waitingQueue.filter(p => isStrictlyWaitingStatus(p.status)).length, 'patients');
      console.log('  - Appelés:', waitingQueue.filter(p => isCalledInQueueStatus(p.status)).length, 'patients');
      console.log('  - Présents:', waitingQueue.filter(p => isPresentInQueueStatus(p.status)).length, 'patients');
      console.log('  - En consultation:', waitingQueue.filter(p => isInConsultationQueueStatus(p.status)).length, 'patients');
      console.log('  - Total file d\'attente:', waitingQueue.length, 'patients');
    }
  }, [waitingQueue]);

  const setupRealtimeSubscription = () => {
    if (!userProfile?.id) return;
    
    const channel = supabase.channel('doctor_waiting_queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'waiting_queue',
        filter: `medecin_id=eq.${userProfile.id}`
      }, () => {
        fetchWaitingQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const setupNotificationSubscription = () => {
    if (!userProfile?.id || !userProfile?.role) return;

    console.log('🔌 [MyWaitingQueue] Configuration de l\'abonnement aux notifications...');
    setWebsocketStatus('connecting');

    // S'abonner aux notifications médecin-secrétaire
    const channel = subscribeToNotifications(userProfile.id, userProfile.role, (payload) => {
      console.log('🔔 [MyWaitingQueue] Notification reçue:', payload);
      setWebsocketStatus('connected');
      
      if (payload.eventType === 'INSERT') {
        const notification = payload.new;
        
        // Si c'est une notification que le patient est appelé
        if (notification.type_notification === 'patient_on_way') {
          // Mettre à jour le status du patient vers 'present'
          const waitingQueueId = notification.waiting_queue_id;
          if (waitingQueueId) {
            handlePatientAction(waitingQueueId, 'receive');
          }
        }
      }
    });

    // Surveiller l'état de la connexion
    if (channel) {
      // Écouter les changements de statut du canal
      const checkConnectionStatus = () => {
        const channelState = channel.state;
        console.log('📡 [MyWaitingQueue] État du canal WebSocket:', channelState);
        
        switch (channelState) {
          case 'joined':
            setWebsocketStatus('connected');
            break;
          case 'joining':
            setWebsocketStatus('connecting');
            break;
          case 'closed':
            setWebsocketStatus('disconnected');
            break;
          case 'errored':
            setWebsocketStatus('error');
            break;
          default:
            setWebsocketStatus('connecting');
        }
      };

      // Vérifier l'état initial
      checkConnectionStatus();

      // Vérifier périodiquement l'état
      const statusInterval = setInterval(checkConnectionStatus, 5000);

      return () => {
        clearInterval(statusInterval);
        if (channel) {
          unsubscribeFromNotifications(channel);
        }
        setWebsocketStatus('disconnected');
      };
    } else {
      setWebsocketStatus('error');
    }
  };

  const fetchData = async () => {
    try {
      console.log('🔄 [MyWaitingQueue] Début du chargement des données...');
      
      let profile = null;
      if (currentUser) {
        console.log('👤 [MyWaitingQueue] Récupération du profil utilisateur...');
        profile = await getUserProfile();
        setUserProfile(profile);
        console.log('✅ [MyWaitingQueue] Profil utilisateur récupéré:', profile?.id, profile?.nom, profile?.prenom);
      } else {
        console.log('⚠️ [MyWaitingQueue] Aucun utilisateur connecté');
      }
      
      if (profile?.id) {
        console.log('📊 [MyWaitingQueue] Chargement parallèle des données...');
        await Promise.all([
          fetchWaitingQueue(profile),
          fetchAppointments(profile),
          fetchNotifications(profile)
        ]);
      } else {
        console.log('⚠️ [MyWaitingQueue] Pas de profil utilisateur, arrêt du chargement');
      }
      
      console.log('🎉 [MyWaitingQueue] Chargement terminé avec succès!');
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitingQueue = async (profile = userProfile) => {
    try {
      if (!profile?.id) {
        console.log('⚠️ [MyWaitingQueue] Pas de profil utilisateur, arrêt du chargement');
        return;
      }
      
      console.log('📋 [MyWaitingQueue] Médecin connecté ID:', profile.id);
      console.log('📋 [MyWaitingQueue] Requête filtre medecin_id:', profile.id);
      
      // Calculer les bornes de la date d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      // Récupérer la file d'attente active du médecin avec présence confirmée et statut d'attente
      // Filtrer pour n'afficher que les patients réellement en attente (pas déjà en consultation)
      const { data: queueData, error: queueError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointments(date_heure, statut_arrivee, heure_arrivee, statut, motif, duree)
        `)
        .eq('medecin_id', profile.id)
        .gte('created_at', todayStart)
        .lt('created_at', tomorrowStart)
        .gte('appointments.date_heure', todayStart)
        .lt('appointments.date_heure', tomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive') // Only patients with confirmed presence
        .in('status', ['waiting', 'en_attente', 'present', 'arrive', 'authorized', 'called', 'appele', 'en_route', 'medecin_pret']) // Only waiting status (not in consultation)
        .order('order_position', { ascending: true });

      if (queueError) {
        console.error('❌ [MyWaitingQueue] Erreur file d\'attente:', queueError);
        throw queueError;
      }

      const queueList = Array.isArray(queueData) ? queueData : [];

      if (queueList.length === 0) {
        console.log('⚠️ [MyWaitingQueue] Aucune entrée active pour aujourd\'hui (medecin_id=', profile.id, ')');
        setWaitingQueue([]);
        return;
      }

      // 2) Récupérer les patients référencés
      const patientIds = Array.from(new Set(queueList.map(w => w.patient_id).filter(Boolean)));
      let patientMap = {};
      
      if (patientIds.length > 0) {
        const { data: patientsData, error: patientsError } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier, date_naissance')
          .in('id', patientIds);
        
        if (patientsError) {
          console.error('❌ [MyWaitingQueue] Erreur patients:', patientsError);
        } else if (patientsData) {
          patientMap = Object.fromEntries(patientsData.map(p => [p.id, p]));
        }
      }

      // 3) Fusionner les données
      const enrichedQueue = queueList.map(item => ({
        ...item,
        patient: patientMap[item.patient_id] || null
      }));

      // 4) Filtrer pour exclure les statuts terminaux
      const activeQueue = enrichedQueue.filter(item => isActiveQueueStatus(item.status));

      console.log('✅ [MyWaitingQueue] File d\'attente récupérée:', activeQueue.length, 'patients');
      console.log('📊 [MyWaitingQueue] Détails des patients:', activeQueue);
      setWaitingQueue(activeQueue);
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur lors du chargement de la file d\'attente:', error);
    }
  };

  const fetchAppointments = async (profile = userProfile) => {
    try {
      if (!profile?.id) {
        console.log('⚠️ [MyWaitingQueue] Pas de profil utilisateur pour les rendez-vous');
        return;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log('📅 [MyWaitingQueue] Médecin connecté ID:', profile.id);
      console.log('📅 [MyWaitingQueue] Requête filtre medecin_id:', profile.id);
      console.log('📅 [MyWaitingQueue] Période:', today.toISOString(), 'à', tomorrow.toISOString());
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(nom, prenom, telephone, numero_dossier)
        `)
        .eq('medecin_id', profile.id)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure', { ascending: true });

      if (error) {
        console.error('❌ [MyWaitingQueue] Erreur rendez-vous:', error);
        throw error;
      }
      console.log('✅ [MyWaitingQueue] Rendez-vous récupérés:', data?.length || 0, 'rendez-vous');
      setAppointments(data || []);
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const fetchNotifications = async (profile = userProfile) => {
    try {
      if (!profile?.id) return;

      // Calculer la date d'aujourd'hui (minuit)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const { data, error } = await supabase
        .from('notifications_consultation')
        .select('*')
        .eq('destinataire_id', profile.id)
        .eq('lu', false)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };

  const handlePatientAction = async (patientId, action) => {
    try {
      const currentPatient = waitingQueue.find((p) => p.id === patientId);

      // Vérifier s'il y a déjà une consultation en cours
      if (action === 'consultation' && consultationEnCours) {
        // Afficher un toast d'avertissement
        if (window.showNotification) {
          window.showNotification({
            message: 'Une consultation est déjà en cours. Terminez-la avant d\'en commencer une nouvelle.',
            type: 'warning',
            duration: 4000
          });
        }
        return;
      }

      let newStatus;
      
      switch (action) {
        case 'call':
          // Le RPC met déjà le statut à 'appele'
          await handleCallPatient(patientId);
          await fetchWaitingQueue();
          return;
        case 'receive':
          newStatus = 'present';
          break;
        case 'consultation':
          // S'assurer qu'il n'y a qu'un seul patient en consultation
          if (patientsEnConsultation.length > 0) {
            // Afficher un toast d'avertissement
            if (window.showNotification) {
              window.showNotification({
                message: 'Une consultation est déjà en cours. Terminez-la avant d\'en commencer une nouvelle.',
                type: 'warning',
                duration: 4000
              });
            }
            return;
          }
          newStatus = 'in_consultation';
          // Notifier le secrétaire que la consultation commence
          await handleConsultationStarted(patientId);
          break;
        case 'finish':
          // Le RPC met déjà le statut à 'termine'
          await handleConsultationFinished(patientId);
          await fetchWaitingQueue();
          return;
        case 'absent':
          newStatus = 'absent';
          break;
        default:
          console.log('⚠️ [MyWaitingQueue] Action non reconnue:', action);
          return;
      }

      // Skip workflow validation for 'call' action (Introduire) - it's just a request, not a confirmation
      if (action !== 'call' && currentPatient) {
        const transition = validateQueueTransition(currentPatient.status, newStatus);
        if (
          transition.needsConfirmation &&
          !confirmSkippedWorkflowSteps(transition.skippedSteps, 'changer le statut du patient')
        ) {
          return;
        }
      }

      console.log('🔄 [MyWaitingQueue] Action patient:', action, 'pour patient:', patientId, 'nouveau statut:', newStatus);
      
      const { error: updateError } = await supabase
        .from('waiting_queue')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (updateError) {
        console.error('❌ [MyWaitingQueue] Erreur mise à jour status:', updateError);
        throw updateError;
      }
      
      console.log('✅ [MyWaitingQueue] Status mis à jour:', patientId, '->', newStatus);
      
      // Forcer le rafraîchissement immédiat pour synchronisation
      await fetchWaitingQueue();
      
      // Notifier les autres composants du changement
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('patientStatusChanged', {
          detail: { patientId, newStatus, action }
        }));
      }
      
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur lors de l\'action sur le patient:', error);
    }
  };

  // Fonctions de gestion des notifications
  const handleCallPatient = async (waitingQueueId) => {
    try {
      // Trouver le patient dans la file d'attente
      const patient = waitingQueue.find(p => p.id === waitingQueueId);
      if (!patient) return;

      // Utiliser le RPC pour appeler le patient
      await doctorService.callPatient(waitingQueueId, userProfile.id);

      // Démarrer le compteur de 60 secondes
      setCallCountdown({
        waitingQueueId,
        seconds: 60,
        patientName: `${patient.patient?.prenom} ${patient.patient?.nom}`
      });

      console.log('✅ [MyWaitingQueue] Patient appelé via RPC');
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur notification introduction:', error);
    }
  };

  const handleConsultationStarted = async (waitingQueueId) => {
    try {
      const patient = waitingQueue.find(p => p.id === waitingQueueId);
      if (!patient) return;

      const { data: secretaries } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'secretary')
        .limit(1);

      if (!secretaries || secretaries.length === 0) return;

      const secretaryId = secretaries[0].id;
      const patientName = `${patient.patient?.prenom} ${patient.patient?.nom}`;

      // Note: Pour l'instant, on n'envoie pas de notification au début de la consultation
      // Vous pouvez ajouter un nouveau type de notification si nécessaire
      console.log('✅ [MyWaitingQueue] Consultation démarrée pour:', patientName);
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur début consultation:', error);
    }
  };

  const handleConsultationFinished = async (waitingQueueId) => {
    try {
      // Utiliser le RPC pour terminer la consultation
      await doctorService.finishConsultation(waitingQueueId, userProfile.id);

      console.log('✅ [MyWaitingQueue] Consultation terminée via RPC');
    } catch (error) {
      console.error('❌ [MyWaitingQueue] Erreur fin consultation:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_attente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'appele': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'present': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'en_consultation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'termine': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'en_attente': return <Clock className="w-4 h-4" />;
      case 'appele': return <PhoneCall className="w-4 h-4" />;
      case 'present': return <UserCheck className="w-4 h-4" />;
      case 'en_consultation': return <Stethoscope className="w-4 h-4" />;
      case 'termine': return <CheckCircle className="w-4 h-4" />;
      case 'absent': return <UserX className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'appele': return 'Appelé';
      case 'present': return 'Présent';
      case 'en_consultation': return 'En consultation';
      case 'termine': return 'Terminé';
      case 'absent': return 'Absent';
      default: return status;
    }
  };

  const getAppointmentStatus = (appointment) => {
    const now = new Date();
    const appointmentTime = new Date(appointment.date_heure);
    const diffMinutes = Math.floor((now - appointmentTime) / (1000 * 60));
    
    if (diffMinutes < 0) return { status: 'a_venir', label: 'À venir', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (diffMinutes <= 15) return { status: 'en_cours', label: 'En cours', color: 'bg-green-100 text-green-800 border-green-200' };
    if (diffMinutes <= 30) return { status: 'retard', label: 'Retard', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { status: 'depasse', label: 'Dépassé', color: 'bg-red-100 text-red-800 border-red-200' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg">Chargement de votre salle d'attente...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Profil utilisateur non trouvé</h3>
          <p className="text-gray-600 mb-6">Votre profil n'a pas été trouvé dans la base de données.</p>
          <button 
            onClick={fetchData}
            className="px-6 py-3 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors font-medium"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const patientsEnAttente = waitingQueue.filter((p) => isStrictlyWaitingStatus(p.status));
  const patientsPresents = waitingQueue.filter((p) => isPresentInQueueStatus(p.status));
  const patientsEnConsultation = waitingQueue.filter((p) => isInConsultationQueueStatus(p.status));
  const patientsAppeles = waitingQueue.filter((p) => isCalledInQueueStatus(p.status));
  const patientsVisibles = waitingQueue.filter((p) => isActiveQueueStatus(p.status));

  // Vérifier s'il y a une consultation en cours
  const consultationEnCours = patientsEnConsultation.length > 0;
  const patientEnConsultation = patientsEnConsultation[0]; // Un seul patient en consultation
  
  const matchesSearch = (patient) =>
    patient.patient?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient?.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase());

  // Afficher tous les patients actifs (en_attente, appele, present, en_consultation…)
  const filteredPatientsEnAttente = patientsVisibles.filter(matchesSearch);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-medical-primary" />
            Salle d'attente
          </h1>
          <p className="text-gray-600 mt-2">
            Dr. {userProfile?.prenom} {userProfile?.nom} - {userProfile?.specialite}
          </p>
          {consultationEnCours && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              <Stethoscope className="w-4 h-4" />
              Consultation en cours avec {patientEnConsultation?.patient?.prenom} {patientEnConsultation?.patient?.nom}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock3 className="w-4 h-4" />
              <span className="text-sm">
                {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            {/* Indicateur de connexion WebSocket */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                websocketStatus === 'connected' ? 'bg-green-500' :
                websocketStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                websocketStatus === 'error' ? 'bg-red-500' :
                'bg-gray-400'
              }`}></div>
              <span className={`text-xs font-medium ${
                websocketStatus === 'connected' ? 'text-green-600' :
                websocketStatus === 'connecting' ? 'text-yellow-600' :
                websocketStatus === 'error' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {websocketStatus === 'connected' ? 'Connecté' :
                 websocketStatus === 'connecting' ? 'Connexion...' :
                 websocketStatus === 'error' ? 'Erreur connexion' :
                 'Déconnecté'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-gray-600">
              {isActive ? 'Statut actif' : 'Statut inactif'}
            </span>
          </div>
          
          <button
            onClick={() => setIsActive(!isActive)}
            className={`btn flex items-center gap-2 ${
              isActive ? 'btn-success' : 'btn-secondary'
            }`}
          >
            {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isActive ? 'Désactiver' : 'Activer'}
          </button>
          
          <button 
            onClick={fetchData}
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Diagnostic WebSocket */}
      {showDiagnostic && (
        <div className="mb-6">
          <WebSocketDiagnostic onStatusChange={setDiagnosticStatus} />
        </div>
      )}

      {/* Bouton pour afficher/masquer le diagnostic */}
      {websocketStatus === 'error' && (
        <div className="mb-4">
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className="btn btn-outline btn-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            {showDiagnostic ? 'Masquer' : 'Afficher'} le diagnostic WebSocket
          </button>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard icon={Clock} tone="blue" label="En attente" value={patientsEnAttente.length} />

        <KpiCard icon={PhoneCall} tone="yellow" label="Appelés" value={patientsAppeles.length} />

        <KpiCard icon={Stethoscope} tone="green" label="En consultation" value={patientsEnConsultation.length} />

        <KpiCard icon={Bell} tone="red" label="Notifications" value={notifications.length} />
      </div>

      {/* Patient Actuel - Section mise en avant */}
      {selectedPatient && (
        <div className="card bg-gradient-to-r from-medical-primary to-medical-secondary text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-white/30">
                {selectedPatient.patient?.prenom?.[0]}{selectedPatient.patient?.nom?.[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Patient Actuel</p>
                <h3 className="text-2xl font-bold text-white">
                  {selectedPatient.patient?.prenom} {selectedPatient.patient?.nom}
                </h3>
                <p className="text-sm text-white/90 mt-1">
                  Dossier: {selectedPatient.patient?.numero_dossier} • {selectedPatient.patient?.telephone}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isPresentInQueueStatus(selectedPatient.status) && (
                <button
                  onClick={() => handlePatientAction(selectedPatient.id, 'consultation')}
                  className="btn bg-white text-medical-primary hover:bg-white/90 flex items-center gap-2 px-6 py-3 text-lg font-semibold"
                >
                  <Stethoscope className="w-5 h-5" />
                  Consulter
                </button>
              )}
              {isInConsultationQueueStatus(selectedPatient.status) && (
                <button
                  onClick={() => handlePatientAction(selectedPatient.id, 'finish')}
                  className="btn bg-green-500 text-white hover:bg-green-600 flex items-center gap-2 px-6 py-3 text-lg font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Terminer
                </button>
              )}
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Fermer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salle d'attente - En Attente (pleine largeur) */}
      <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              File active ({filteredPatientsEnAttente.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 text-sm"
              />
            </div>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-96">
            {filteredPatientsEnAttente.map((patient, index) => {
              const isCalled = isCalledInQueueStatus(patient.status);
              const isPresent = isPresentInQueueStatus(patient.status);
              const isInConsultation = isInConsultationQueueStatus(patient.status);
              const cardClass = isInConsultation
                ? 'border-purple-200 bg-purple-50'
                : isPresent
                  ? 'border-blue-200 bg-blue-50'
                  : isCalled
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-yellow-200 bg-yellow-50';
              const avatarClass = isInConsultation
                ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                : isPresent
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : isCalled
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                    : 'bg-gradient-to-br from-medical-primary to-medical-secondary';
              
              return (
                <div key={patient.id} className={`border ${cardClass} rounded-lg p-4 hover:shadow-md transition-shadow ${isCalled ? 'animate-pulse' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${avatarClass} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                        {patient.patient?.prenom?.[0]}{patient.patient?.nom?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {patient.patient?.prenom} {patient.patient?.nom}
                        </p>
                        <p className="text-small">
                          Dr. {userProfile?.prenom} {userProfile?.nom} {userProfile?.specialite ? `- ${userProfile.specialite}` : ''}
                        </p>
                        <p className="text-body">Dossier: {patient.patient?.numero_dossier}</p>
                        {isCalled && (
                          <p className="text-xs text-orange-600 font-medium">📞 Appelé</p>
                        )}
                        {isPresent && (
                          <p className="text-xs text-blue-600 font-medium">✓ Présent</p>
                        )}
                        {isInConsultation && (
                          <p className="text-xs text-purple-600 font-medium">🩺 En consultation</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-500">
                          Arrivé à {new Date(patient.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Position #{index + 1}
                      </p>
                    </div>
                  </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {patient.patient?.telephone}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(patient.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {isStrictlyWaitingStatus(patient.status) && !isCalled && (
                      <>
                        {callCountdown && callCountdown.waitingQueueId === patient.id ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded cursor-not-allowed">
                            <Clock className="w-3 h-3" />
                            Demande envoyée ⏳
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePatientAction(patient.id, 'call')}
                            disabled={consultationEnCours}
                            className={`btn btn-primary btn-sm flex items-center gap-2 ${
                              consultationEnCours ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={consultationEnCours ? "Consultation en cours" : "Introduire le patient"}
                          >
                            <ArrowRight className="w-4 h-4" />
                            Introduire
                          </button>
                        )}
                      </>
                    )}
                    {isPresent && (
                      <button
                        onClick={() => handlePatientAction(patient.id, 'consultation')}
                        disabled={consultationEnCours}
                        className={`btn btn-success btn-sm flex items-center gap-2 ${
                          consultationEnCours ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Stethoscope className="w-4 h-4" />
                        Consulter
                      </button>
                    )}
                    {isInConsultation && (
                      <button
                        onClick={() => handlePatientAction(patient.id, 'finish')}
                        className="btn btn-success btn-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Terminer
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            })}
            
            {filteredPatientsEnAttente.length === 0 && (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun patient dans la file active</p>
                <p className="text-sm text-gray-400 mt-2">
                  Les patients apparaissent ici après confirmation de présence par la secrétaire.
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Section Rendez-vous */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="w-6 h-6 text-medical-primary" />
            Rendez-vous du jour ({appointments.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Rendez-vous programmés pour aujourd'hui
          </p>
        </div>
        
        <div className="p-4">
          {appointments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-96">
              {appointments.map((appointment) => {
                const status = getAppointmentStatus(appointment);
                return (
                  <div key={appointment.id} className={`bg-gray-50 rounded-lg p-3 border transition-colors ${status.isInQueue ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-100'}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-medical-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {new Date(appointment.date_heure).getHours()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base truncate">
                          {appointment.patient?.prenom} {appointment.patient?.nom}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(appointment.date_heure).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aucun rendez-vous aujourd'hui</p>
              <p className="text-gray-400">Votre planning est libre</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default MyWaitingQueuePage;
