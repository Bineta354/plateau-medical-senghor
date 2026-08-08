import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import {
  Stethoscope,
  Clock,
  AlertTriangle,
  Calendar,
  Phone,
  Activity,
  UserCheck,
  Plus,
  Eye,
  FileImage,
  Upload,
  ClipboardList,
  CheckCircle
} from 'lucide-react';
import PatientDocumentUploader from './PatientDocumentUploader';
import PatientAntecedentsModal from './PatientAntecedentsModal';
import {
  computeQueueStats,
  filterActiveQueueItems,
  isUrgentQueuePriority,
  isOnWaitingBench,
  matchesQueueFilterStatus,
  hasPastAppointment,
} from '../../utils/waitingQueueStatus';
import KpiCard from '../common/KpiCard';

const DoctorSpecificQueue = ({
  doctor,
  searchTerm,
  filterStatus,
  initialQueueFilter = 'all',
}) => {
  const { userProfile } = useAuth();
  const [waitingQueue, setWaitingQueue] = useState([]);
  // Copie non filtrée (tous statuts) de la file du jour, utilisée uniquement
  // pour distinguer les vrais walk-in (sans RDV) des consultations "orphelines"
  // rattachées à un RDV d'un autre jour — voir rendezVousDuJour plus bas.
  const [rawWaitingQueueToday, setRawWaitingQueueToday] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [finishedConsultations, setFinishedConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState(null);
  const [showAntecedentsModal, setShowAntecedentsModal] = useState(false);
  const [selectedPatientForAntecedents, setSelectedPatientForAntecedents] = useState(null);
  const [statFilter, setStatFilter] = useState(initialQueueFilter);
  const queueSectionRef = useRef(null);
  const appointmentsSectionRef = useRef(null);

  useEffect(() => {
    setStatFilter(initialQueueFilter);
  }, [initialQueueFilter, doctor?.id]);

  useEffect(() => {
    if (doctor) {
      fetchDoctorData();
    }
  }, [doctor]);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStatCardClick = (filter) => {
    setStatFilter(filter);
    if (filter === 'appointments') {
      scrollToSection(appointmentsSectionRef);
      return;
    }
    scrollToSection(queueSectionRef);
  };

  // Abonnement temps réel pour la file d'un médecin spécifique
  useEffect(() => {
    if (!doctor) return;
    const channel = supabase
      .channel(`doctor_specific_queue_${doctor.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waiting_queue',
        filter: `medecin_id=eq.${doctor.id}`
      }, (payload) => {
        console.log('🔄 [DoctorSpecificQueue] Changement temps réel détecté:', payload);
        fetchWaitingQueue();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `medecin_id=eq.${doctor.id}`
      }, () => {
        fetchAppointments();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consultations',
        filter: `medecin_id=eq.${doctor.id}`
      }, () => {
        fetchFinishedConsultations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctor]);

  const fetchDoctorData = async () => {
    try {
      console.log('🔄 [DoctorSpecificQueue] Rechargement des données...');
      setLoading(true);
      await Promise.all([
        fetchWaitingQueue(),
        fetchAppointments(),
        fetchFinishedConsultations()
      ]);
      console.log('✅ [DoctorSpecificQueue] Données rechargées avec succès');
    } catch (error) {
      console.error('❌ [DoctorSpecificQueue] Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitingQueue = async () => {
    try {
      console.log('📋 [DoctorSpecificQueue] Récupération de la file d\'attente pour médecin:', doctor.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // waiting_queue n'a pas de FK vers patients (seulement vers appointments) :
      // un embed `patient:patients(...)` échoue silencieusement côté PostgREST
      // (PGRST200) et vide la file. On récupère donc les patients séparément et
      // on fusionne à la main, comme le fait déjà GlobalWaitingQueue.jsx.
      //
      // Scope sur `created_at` du jour (même logique que SalleAttentePage) : sans
      // ça, un patient jamais "clôturé" la veille (statut resté "waiting")
      // continue d'apparaître dans la salle d'attente du jour, faussant les
      // KPI (ex: file affichée incohérente avec le total "Rendez-vous").
      const { data, error } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointment:appointments(motif, duree)
        `)
        .eq('medecin_id', doctor.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('order_position', { ascending: true });

      if (error) {
        console.error('❌ [DoctorSpecificQueue] Erreur récupération file d\'attente:', error);
        throw error;
      }

      const queueList = data || [];
      const patientIds = Array.from(new Set(queueList.map(q => q.patient_id).filter(Boolean)));
      let patientMap = {};

      if (patientIds.length > 0) {
        const { data: patientsData, error: patientsError } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier')
          .in('id', patientIds);

        if (patientsError) {
          console.error('❌ [DoctorSpecificQueue] Erreur récupération patients:', patientsError);
        } else if (patientsData) {
          patientMap = Object.fromEntries(patientsData.map(p => [p.id, p]));
        }
      }

      const enriched = queueList.map(item => ({
        ...item,
        patient: patientMap[item.patient_id] || null,
      }));

      console.log('✅ [DoctorSpecificQueue] File d\'attente récupérée:', enriched.length || 0, 'patients');
      console.log('📊 [DoctorSpecificQueue] Détails file d\'attente:', enriched.map(p => ({
        id: p.id,
        patient_id: p.patient_id,
        appointment_id: p.appointment_id,
        status: p.status,
        patient_name: `${p.patient?.prenom} ${p.patient?.nom}`
      })));

      setWaitingQueue(filterActiveQueueItems(enriched));
      setRawWaitingQueueToday(enriched);
    } catch (error) {
      console.error('❌ [DoctorSpecificQueue] Erreur lors du chargement de la file d\'attente:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(nom, prenom, telephone, numero_dossier)
        `)
        .eq('medecin_id', doctor.id)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const fetchFinishedConsultations = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('consultations')
        .select('id, statut, patient_id')
        .eq('medecin_id', doctor.id)
        .gte('date_consultation', today.toISOString())
        .lt('date_consultation', tomorrow.toISOString())
        .in('statut', ['terminee', 'termine', 'finished', 'completed']);

      if (error) throw error;
      setFinishedConsultations(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des consultations terminées:', error);
    }
  };

  // Fonction pour marquer un patient appelé comme présent
  const handleMarkCalledPatientPresent = async (patientId) => {
    try {
      console.log('✅ [DoctorSpecificQueue] Marquage patient appelé présent:', patientId);
      
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'present',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [DoctorSpecificQueue] Erreur marquage présent:', error);
        throw error;
      }

      console.log('✅ [DoctorSpecificQueue] Patient appelé marqué comme présent:', patientId);
      
      // Recharger les données
      fetchWaitingQueue();
      
      // Afficher une notification de succès
      if (window.showNotification) {
        window.showNotification({
          message: 'Patient marqué comme présent !',
          type: 'success',
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error('❌ [DoctorSpecificQueue] Erreur lors du marquage présent:', error);
      
      // Afficher une notification d'erreur
      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors du marquage du patient comme présent',
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  // Confirmer la présence d'un patient depuis "Rendez-vous du jour" (pas encore
  // en file d'attente) — même RPC que la page Prise de Rendez-vous, pour rester
  // cohérent (statut du RDV mis à jour, médecin notifié), voir
  // PriseRendezVousPage.jsx > handleConfirmPatientPresence.
  const handleConfirmPresence = async (appointment) => {
    try {
      if (!appointment?.id) return;
      const secId = userProfile?.id;
      if (!secId) {
        unifiedNotificationService.error("Impossible d'identifier la secrétaire (secretaireId manquant)");
        return;
      }

      const { data, error } = await supabase.rpc('secretaire_confirme_patient_presence', {
        p_appointment_id: appointment.id,
        p_secretaire_id: secId
      });

      if (error) throw error;

      if (data?.medecin_id && appointment.patient) {
        const { sendNotification, NOTIFICATION_TYPES } = await import('../../lib/notifications');
        const patientName = `${appointment.patient.prenom ?? ''} ${appointment.patient.nom ?? ''}`.trim();
        await sendNotification(
          NOTIFICATION_TYPES.PATIENT_ARRIVED,
          secId,
          data.medecin_id,
          null,
          patientName,
          { appointmentId: appointment.id, patientId: data.patient_id }
        );
      }

      await fetchDoctorData();
      unifiedNotificationService.success(data?.message || 'Patient confirmé présent et ajouté à la salle d\'attente');
    } catch (error) {
      console.error('❌ [DoctorSpecificQueue] Erreur lors de la confirmation de présence:', error);
      unifiedNotificationService.error(error.message || 'Erreur lors de la confirmation de présence');
    }
  };

  const getStatusColor = (status, patient) => {
    // Si le rendez-vous est passé, forcer le statut "Terminé"
    if (patient && hasPastAppointment(patient)) {
      return 'text-green-600 bg-green-100';
    }
    
    switch (status) {
      case 'in_consultation': return 'text-blue-600 bg-blue-100';
      case 'present': return 'text-purple-600 bg-purple-100';
      case 'late': return 'text-orange-600 bg-orange-100';
      case 'waiting': return 'text-yellow-600 bg-yellow-100';
      case 'finished': return 'text-green-600 bg-green-100';
      case 'emergency': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status, patient) => {
    // Si le rendez-vous est passé, forcer le statut "Terminé"
    if (patient && hasPastAppointment(patient)) {
      return 'Terminé';
    }
    
    switch (status) {
      case 'in_consultation': return 'En consultation';
      case 'present': return 'Présent';
      case 'late': return 'En retard';
      case 'waiting': return 'En attente';
      case 'finished': return 'Terminé';
      case 'emergency': return 'Urgence';
      default: return status;
    }
  };

  const getUrgencyColor = (priority) => {
    switch (priority) {
      case 'urgente': return 'text-red-600 bg-red-100';
      case 'tres_urgente': return 'text-red-800 bg-red-200';
      case 'normale': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const calculateWaitTime = (arrivedAt) => {
    if (!arrivedAt) return 0;
    const arrivalTime = new Date(arrivedAt);
    const now = new Date();
    const diffMs = now - arrivalTime;
    return Math.floor(diffMs / (1000 * 60));
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const filterPatients = () => {
    let filtered = filterActiveQueueItems(waitingQueue);

    const queueFilter =
      statFilter === 'appointments'
        ? filterStatus
        : statFilter !== 'all'
          ? statFilter
          : filterStatus;

    if (queueFilter === 'urgent') {
      filtered = filtered.filter(
        (patient) => isOnWaitingBench(patient.status) && isUrgentQueuePriority(patient.priority),
      );
    } else if (queueFilter !== 'all') {
      filtered = filtered.filter((patient) =>
        matchesQueueFilterStatus(queueFilter, patient.status),
      );
    }

    // Filtre par recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(patient => {
        const patientName = `${patient.patient?.prenom} ${patient.patient?.nom}`.toLowerCase();
        return patientName.includes(searchLower);
      });
    }

    return filtered;
  };

  const filterAppointments = () => {
    let filtered = appointments;

    // Filtre par recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(appointment => {
        const patientName = `${appointment.patient?.prenom} ${appointment.patient?.nom}`.toLowerCase();
        return patientName.includes(searchLower);
      });
    }

    return filtered;
  };

  const isPatientInQueue = (patientId, appointmentId = null) => {
    const isInQueue = waitingQueue.some(patient => {
      if (appointmentId) {
        // Vérifier si le patient est en file pour ce rendez-vous spécifique
        return patient.patient_id === patientId && patient.appointment_id === appointmentId;
      } else {
        // Vérifier si le patient est en file pour n'importe quel rendez-vous
        return patient.patient_id === patientId;
      }
    });
    console.log('🔍 [DoctorSpecificQueue] Vérification patient en file:', { 
      patientId, 
      appointmentId,
      isInQueue, 
      waitingQueueLength: waitingQueue.length,
      waitingQueuePatients: waitingQueue.map(p => ({ 
        id: p.patient_id, 
        appointment_id: p.appointment_id,
        status: p.status 
      }))
    });
    return isInQueue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  const filteredPatients = filterPatients();
  const filteredAppointments = filterAppointments();
  const queueStats = computeQueueStats(waitingQueue);
  const urgentCount = filterActiveQueueItems(waitingQueue).filter(
    (p) => isOnWaitingBench(p.status) && isUrgentQueuePriority(p.priority),
  ).length;
  // Une consultation "terminée aujourd'hui" (date_consultation) peut être
  // rattachée à un RDV d'un autre jour resté ouvert (ex: RDV de la veille
  // jamais clôturé, consulté après minuit) : consultations.appointment_id
  // n'est pas fiabilisé, donc on ne peut pas filtrer dessus. On ne garde donc
  // dans les KPI que les consultations dont le patient a soit un RDV
  // aujourd'hui, soit un passage en file aujourd'hui sans RDV (vrai walk-in)
  // — ça exclut ces orphelines sans faire disparaître les vrais walk-in.
  const todayAppointmentPatientIds = new Set(appointments.map((a) => a.patient_id));
  const todayWalkinPatientIds = new Set(
    rawWaitingQueueToday.filter((q) => !q.appointment_id).map((q) => q.patient_id),
  );
  const relevantFinishedConsultations = finishedConsultations.filter(
    (c) => todayAppointmentPatientIds.has(c.patient_id) || todayWalkinPatientIds.has(c.patient_id),
  );
  // "Rendez-vous" doit s'incrémenter dès la création d'un RDV, indépendamment
  // de la présence du patient (pas seulement une fois arrivé/en
  // consultation/terminé) — donc basé sur `appointments` (même source que le
  // panneau "Rendez-vous du Jour" ci-dessous), plus les vrais walk-in ajoutés
  // en file sans RDV (qui n'apparaissent pas dans `appointments`).
  const walkinOnlyPatientIds = Array.from(todayWalkinPatientIds).filter(
    (patientId) => !todayAppointmentPatientIds.has(patientId),
  );
  const rendezVousDuJour = appointments.length + walkinOnlyPatientIds.length;

  return (
    <div key={refreshKey} className="p-6">
      {/* En-tête du médecin */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-medical-primary rounded-full flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Dr. {doctor.prenom} {doctor.nom}
            </h2>
            <p className="text-gray-600">{doctor.specialite}</p>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            tone="blue"
            icon={Calendar}
            label="Rendez-vous"
            value={rendezVousDuJour}
            onClick={() => handleStatCardClick('appointments')}
            active={statFilter === 'appointments'}
            hoverMessage="Voir les rendez-vous du jour"
          />
          <KpiCard
            tone="yellow"
            icon={Clock}
            label="En salle d'attente"
            value={queueStats.onBench}
            onClick={() => handleStatCardClick('waiting')}
            active={statFilter === 'waiting'}
            hoverMessage="Filtrer les patients en salle d'attente"
          />
          <KpiCard
            tone="red"
            icon={AlertTriangle}
            label="Urgent en attente"
            value={urgentCount}
            onClick={() => handleStatCardClick('urgent')}
            active={statFilter === 'urgent'}
            hoverMessage="Filtrer les patients urgents en salle d'attente"
          />
          <KpiCard
            tone="green"
            icon={CheckCircle}
            label="Terminé"
            value={relevantFinishedConsultations.length}
            hoverMessage="Consultations terminées aujourd'hui"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salle d'attente */}
        <div
          ref={queueSectionRef}
          className="bg-white border border-gray-200 rounded-lg shadow-sm scroll-mt-4"
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Salle d'attente
            </h3>
          </div>
          
          <div className="p-4">
            {filteredPatients.length > 0 ? (
              <div className="space-y-3">
                {filteredPatients.map((patient, index) => {
                  const waitTime = calculateWaitTime(patient.arrived_at);
                  
                  return (
                    <div 
                      key={patient.id} 
                      className={`border rounded-lg p-4 transition-all duration-200 ${
                        patient.status === 'appele' ? 'border-orange-300 bg-orange-50' :
                        patient.status === 'entre' ? 'border-purple-300 bg-purple-50' :
                        patient.status === 'en_consultation' ? 'border-blue-300 bg-blue-50' :
                        patient.priority === 'urgente' || patient.priority === 'tres_urgente' ? 'border-red-300 bg-red-50' :
                        'border-gray-200 bg-gray-50'
                      } ${patient.status === 'appele' ? 'patient-called animate-pulse' : ''} ${patient.status === 'en_consultation' ? 'opacity-60 grayscale' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-medical-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {patient.patient?.prenom} {patient.patient?.nom}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Dossier: {patient.patient?.numero_dossier}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              Arrivé à {formatTime(patient.arrived_at)}
                            </span>
                            <span className="flex items-center">
                              <Activity className="w-4 h-4 mr-1" />
                              {waitTime} min d'attente
                            </span>
                          </div>
                          
                          {patient.appointment?.motif && (
                            <p className="text-sm text-gray-600">
                              Motif: {patient.appointment.motif}
                            </p>
                          )}
                          {patient.appointment?.type_rdv && (
                            <p className={`text-xs font-semibold px-2 py-1 rounded w-fit ${
                              patient.appointment.type_rdv === 'consultation' ? 'bg-purple-100 text-purple-700' :
                              patient.appointment.type_rdv === 'suivi' ? 'bg-cyan-100 text-cyan-700' :
                              patient.appointment.type_rdv === 'urgence' ? 'bg-red-100 text-red-700' :
                              patient.appointment.type_rdv === 'preventif' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {patient.appointment.type_rdv === 'consultation' && '🏥 Consultation'}
                              {patient.appointment.type_rdv === 'suivi' && '📋 Suivi'}
                              {patient.appointment.type_rdv === 'urgence' && '🚑 Urgence'}
                              {patient.appointment.type_rdv === 'preventif' && '💚 Préventif'}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(patient.status, patient)}`}>
                              {getStatusLabel(patient.status, patient)}
                            </span>
                            {patient.status === 'en_consultation' && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                                Consultation en cours
                              </span>
                            )}
                            {patient.priority && (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getUrgencyColor(patient.priority)}`}>
                                {patient.priority === 'urgente' || patient.priority === 'tres_urgente' && (
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                )}
                                {patient.priority}
                              </span>
                            )}
                          </div>
                          
                          {/* Bouton pour marquer comme présent - visible seulement pour les patients appelés */}
                          {patient.status === 'appele' && (
                            <button
                              onClick={() => handleMarkCalledPatientPresent(patient.id)}
                              className="inline-flex items-center px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors duration-200 shadow-sm hover:shadow-md"
                              title="Marquer le patient comme présent"
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              Présent
                            </button>
                          )}
                          
                          {/* Bouton pour scanner des documents */}
                          <button
                            onClick={() => {
                              setSelectedPatientForUpload(patient.patient);
                              setShowUploadModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-md transition-colors duration-200 shadow-sm hover:shadow-md"
                            title="Scanner des documents"
                          >
                            <FileImage className="w-3 h-3 mr-1" />
                            Scanner
                          </button>

                          {/* Bouton pour saisir les antécédents */}
                          <button
                            onClick={() => {
                              setSelectedPatientForAntecedents(patient.patient);
                              setShowAntecedentsModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded-md transition-colors duration-200 shadow-sm hover:shadow-md"
                            title="Saisir les antécédents médicaux"
                          >
                            <ClipboardList className="w-3 h-3 mr-1" />
                            Antécédents
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Aucun patient en salle d'attente</p>
              </div>
            )}
          </div>
        </div>

        {/* Rendez-vous du jour */}
        <div
          ref={appointmentsSectionRef}
          className="bg-white border border-gray-200 rounded-lg shadow-sm scroll-mt-4"
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Rendez-vous du Jour
            </h3>
          </div>
          
          <div className="p-4">
            {filteredAppointments.length > 0 ? (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {filteredAppointments.map((appointment) => {
                  // Ne pas se fier qu'à la file active : un RDV "terminé" ou
                  // "annulé" n'est plus dans waitingQueue (filterActiveQueueItems
                  // l'exclut) mais ne doit pas non plus réafficher "Marquer présent".
                  const isInQueue = isPatientInQueue(appointment.patient_id, appointment.id);
                  const isArrived = isInQueue || appointment.statut === 'arrive';
                  const isTerminated = appointment.statut === 'termine';
                  const isCancelled = appointment.statut === 'annule';

                  return (
                    <div
                      key={appointment.id}
                      className={`border rounded-lg p-3 transition-all duration-200 ${
                        isArrived ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {formatTime(appointment.date_heure).split(':')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-base truncate">
                              {appointment.patient?.prenom} {appointment.patient?.nom}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {formatTime(appointment.date_heure)}
                            </p>
                          </div>
                        </div>

                        {isArrived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium flex-shrink-0">
                            <UserCheck className="w-3 h-3" />
                            En salle d'attente
                          </span>
                        ) : isTerminated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex-shrink-0">
                            Terminé
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-600 text-xs font-medium flex-shrink-0">
                            Annulé
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConfirmPresence(appointment)}
                            className="inline-flex items-center px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                            title="Confirmer la présence du patient"
                          >
                            <UserCheck className="w-3 h-3 mr-1" />
                            Marquer présent
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Aucun rendez-vous aujourd'hui</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'upload de documents */}
      {showUploadModal && selectedPatientForUpload && (
        <PatientDocumentUploader
          patient={selectedPatientForUpload}
          onUploadSuccess={() => {
            setShowUploadModal(false);
            setSelectedPatientForUpload(null);
          }}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedPatientForUpload(null);
          }}
        />
      )}

      {/* Modal des antécédents médicaux */}
      {showAntecedentsModal && selectedPatientForAntecedents && (
        <PatientAntecedentsModal
          patient={selectedPatientForAntecedents}
          onClose={() => {
            setShowAntecedentsModal(false);
            setSelectedPatientForAntecedents(null);
          }}
        />
      )}
    </div>
  );
};

export default DoctorSpecificQueue;

