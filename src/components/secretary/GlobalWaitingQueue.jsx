import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Stethoscope,
  Clock,
  AlertTriangle,
  Users,
  Eye,
  Phone,
  Calendar,
  Activity,
  CheckCircle,
  UserCheck,
  FileImage,
  Upload
} from 'lucide-react';
import PatientDocumentUploader from './PatientDocumentUploader';
import DoctorReassignModal from './DoctorReassignModal';
import {
  computeQueueStats,
  filterActiveQueueItems,
  isUrgentQueuePriority,
  matchesQueueFilterStatus,
  hasPastAppointment,
  filterOutPastAppointments,
  isStuckInConsultation,
  filterOutStuckConsultations,
  isAbandonedOver24h,
} from '../../utils/waitingQueueStatus';
import ClickableStatCard from '../common/ClickableStatCard';
import { shouldHidePastAppointment } from '../../utils/appointmentDisplay';

const GlobalWaitingQueue = ({
  doctors,
  searchTerm,
  filterStatus = 'all',
  onDoctorSelect,
  onNavigateCalendar,
  onNavigateWaitingRoom,
  onFilterStatus,
}) => {
  const { userProfile } = useAuth();
  const tenantId = userProfile?.tenant_id || null;
  const [waitingQueues, setWaitingQueues] = useState({});
  const [appointmentsByDoctor, setAppointmentsByDoctor] = useState({});
  const [consultationsByDoctor, setConsultationsByDoctor] = useState({});
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedPatientForReassign, setSelectedPatientForReassign] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [doctors]);

  // Abonnement temps réel pour actualiser automatiquement les files
  useEffect(() => {
    if (!doctors || doctors.length === 0) return;
    const channel = supabase
      .channel('global_waiting_queue_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waiting_queue'
      }, () => {
        fetchAllData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments'
      }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctors]);

  const fetchAllData = async () => {
    try {
      const queues = {};
      const apptsByDoc = {};

      if (!doctors || doctors.length === 0) {
        setWaitingQueues({});
        setAppointmentsByDoctor({});
        setLoading(false);
        return;
      }

      const medecinIds = doctors.map(d => d.id);

      // Calculer les bornes de la date d'aujourd'hui pour la file d'attente
      const queueToday = new Date();
      queueToday.setHours(0, 0, 0, 0);
      const queueTodayStart = queueToday.toISOString();
      const queueTomorrow = new Date(queueToday);
      queueTomorrow.setDate(queueTomorrow.getDate() + 1);
      const queueTomorrowStart = queueTomorrow.toISOString();

      // 1) Récupérer les files d'attente avec jointure sur appointments et filtre sur statut_arrivee = 'arrive'
      const { data: waitingData, error: waitingError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointments(date_heure, statut_arrivee, heure_arrivee)
        `)
        .in('medecin_id', medecinIds)
        .gte('appointments.date_heure', queueTodayStart)
        .lt('appointments.date_heure', queueTomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive')
        .order('order_position', { ascending: true });

      if (waitingError) {
        console.error('Erreur waiting_queue:', waitingError);
        throw waitingError;
      }

      const waitingList = Array.isArray(waitingData) ? waitingData : [];
      
      // 2) Récupérer les patients référencés
      const patientIds = Array.from(new Set(waitingList.map(w => w.patient_id).filter(Boolean)));
      let patientMap = {};
      
      if (patientIds.length > 0) {
        const { data: patientsData, error: patientsError } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier')
          .in('id', patientIds);
        
        if (patientsError) {
          console.error('Erreur patients:', patientsError);
        } else if (patientsData) {
          patientMap = Object.fromEntries(patientsData.map(p => [p.id, p]));
        }
      }

      // 3) Récupérer les appointments référencés
      const appointmentIds = Array.from(new Set(waitingList.map(w => w.appointment_id).filter(Boolean)));
      let appointmentMap = {};
      
      if (appointmentIds.length > 0) {
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('id, motif, duree, date_heure, priorite')
          .in('id', appointmentIds);
        
        if (appointmentsError) {
          console.error('Erreur appointments:', appointmentsError);
        } else if (appointmentsData) {
          appointmentMap = Object.fromEntries(appointmentsData.map(a => [a.id, a]));
        }
      }

      // 4) Fusionner les données
      waitingList.forEach(item => {
        const enrichedItem = {
          ...item,
          patient: patientMap[item.patient_id] || null,
          appointment: appointmentMap[item.appointment_id] || null
        };
        
        const key = item.medecin_id;
        if (!queues[key]) queues[key] = [];
        queues[key].push(enrichedItem);
      });

      // 5) Mettre à jour automatiquement le statut des patients avec rendez-vous passés
      const now = new Date();
      const allQueueItems = Object.values(queues).flat();
      const pastAppointments = allQueueItems.filter(item => hasPastAppointment(item, now));
      const stuckConsultations = allQueueItems.filter(item => isStuckInConsultation(item, now));
      
      if (pastAppointments.length > 0) {
        // Mettre à jour le statut des patients passés à "Non honoré"
        for (const item of pastAppointments) {
          try {
            await supabase
              .from('waiting_queue')
              .update({ 
                status: 'non_honore',
                updated_at: now.toISOString()
              })
              .eq('id', item.id);
          } catch (error) {
            console.error('Erreur lors de la mise à jour du statut du patient passé:', error);
          }
        }
      }

      if (stuckConsultations.length > 0) {
        // Mettre à jour le statut des consultations bloquées à "Terminé"
        for (const item of stuckConsultations) {
          try {
            await supabase
              .from('waiting_queue')
              .update({ 
                status: 'termine',
                updated_at: now.toISOString()
              })
              .eq('id', item.id);
          } catch (error) {
            console.error('Erreur lors de la mise à jour du statut de consultation bloquée:', error);
          }
        }
      }

      // 6) Filtrer les patients actifs et exclure ceux avec rendez-vous passés et consultations bloquées
      Object.keys(queues).forEach(doctorId => {
        const activeItems = filterActiveQueueItems(queues[doctorId]);
        const filteredItems = filterOutPastAppointments(activeItems, now);
        const finalFilteredItems = filterOutStuckConsultations(filteredItems, now);
        queues[doctorId] = finalFilteredItems;
      });

      // 7) Récupérer tous les rendez-vous du jour pour ces médecins
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select('*')
        .in('medecin_id', medecinIds)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure', { ascending: true });

      if (apptsError) {
        console.error('Erreur appointments du jour:', apptsError);
        throw apptsError;
      }

      const apptsList = Array.isArray(apptsData) ? apptsData : [];
      
      // 8) Récupérer les patients pour les RDV du jour
      const apptPatientIds = Array.from(new Set(apptsList.map(a => a.patient_id).filter(Boolean)));
      let apptPatientMap = {};
      
      if (apptPatientIds.length > 0) {
        const { data: apptPatientsData, error: apptPatientsError } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier')
          .in('id', apptPatientIds);
        
        if (apptPatientsError) {
          console.error('Erreur patients RDV:', apptPatientsError);
        } else if (apptPatientsData) {
          apptPatientMap = Object.fromEntries(apptPatientsData.map(p => [p.id, p]));
        }
      }

      // 9) Fusionner les RDV avec les patients
      apptsList.forEach(appt => {
        const enrichedAppt = {
          ...appt,
          patient: apptPatientMap[appt.patient_id] || null
        };
        
        const key = appt.medecin_id;
        if (!apptsByDoc[key]) apptsByDoc[key] = [];
        apptsByDoc[key].push(enrichedAppt);
      });

      setWaitingQueues(queues);
      setAppointmentsByDoctor(apptsByDoc);

      // 10) Récupérer les consultations du jour pour chaque médecin
      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select('*')
        .in('medecin_id', medecinIds)
        .gte('date_consultation', today.toISOString())
        .lt('date_consultation', tomorrow.toISOString());

      if (consultationsError) {
        console.error('Erreur consultations du jour:', consultationsError);
      } else if (consultationsData) {
        const consultationsByDoc = {};
        consultationsData.forEach(consultation => {
          const key = consultation.medecin_id;
          if (!consultationsByDoc[key]) consultationsByDoc[key] = [];
          consultationsByDoc[key].push(consultation);
        });
        setConsultationsByDoctor(consultationsByDoc);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des files d\'attente:', error);
      console.error('Détails de l\'erreur:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour marquer un patient comme présent
  const handleMarkPatientPresent = async (patientId) => {
    try {
      console.log('✅ [GlobalWaitingQueue] Marquage patient présent:', patientId);
      
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'present',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [GlobalWaitingQueue] Erreur marquage présent:', error);
        throw error;
      }

      console.log('✅ [GlobalWaitingQueue] Patient marqué comme présent:', patientId);
      
      // Recharger les données
      fetchAllData();
      
      // Afficher une notification de succès
      if (window.showNotification) {
        window.showNotification({
          message: 'Patient marqué comme présent !',
          type: 'success',
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error('❌ [GlobalWaitingQueue] Erreur lors du marquage présent:', error);
      
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

  // Ajouter un rendez-vous du jour en file d'attente pour un médecin
  const handleAddAppointmentToQueue = async (doctorId, appointment) => {
    try {
      // Vérifier s'il est déjà en file pour ce RDV
      const { data: existing } = await supabase
        .from('waiting_queue')
        .select('id')
        .eq('patient_id', appointment.patient_id)
        .eq('medecin_id', doctorId)
        .eq('appointment_id', appointment.id)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        if (window.showNotification) {
          window.showNotification({ message: 'Le patient est déjà en file d\'attente', type: 'warning', duration: 2500 });
        }
        return;
      }

      // Trouver la dernière position
      const { data: currentQueue } = await supabase
        .from('waiting_queue')
        .select('order_position')
        .eq('medecin_id', doctorId)
        .order('order_position', { ascending: false })
        .limit(1);

      const nextPosition = currentQueue && currentQueue.length > 0 ? currentQueue[0].order_position + 1 : 1;

      const { error } = await supabase
        .from('waiting_queue')
        .insert([{
          patient_id: appointment.patient_id,
          medecin_id: doctorId,
          appointment_id: appointment.id,
          status: 'waiting',
          priority: 'normale',
          arrived_at: new Date().toISOString(),
          order_position: nextPosition
        }]);

      if (error) throw error;

      if (window.showNotification) {
        window.showNotification({ message: 'Patient ajouté à la file', type: 'success', duration: 2500 });
      }

      fetchAllData();
    } catch (e) {
      console.error('Erreur ajout RDV à la file:', e);
      if (window.showNotification) {
        window.showNotification({ message: 'Erreur lors de l\'ajout à la file', type: 'error', duration: 3000 });
      }
    }
  };

  // Gérer la réassignation d'un patient à un autre médecin
  const handleReassign = (patient) => {
    setSelectedPatientForReassign(patient);
    setShowReassignModal(true);
  };

  const handleReassignComplete = () => {
    setShowReassignModal(false);
    setSelectedPatientForReassign(null);
    fetchAllData();
    if (window.showNotification) {
      window.showNotification({ 
        message: 'Patient réassigné avec succès', 
        type: 'success', 
        duration: 3000 
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_consultation':
      case 'en_consultation': return 'text-blue-600 bg-blue-100';
      case 'entre': return 'text-purple-600 bg-purple-100';
      case 'appele': return 'text-orange-600 bg-orange-100';
      case 'waiting':
      case 'en_attente': return 'text-yellow-600 bg-yellow-100';
      case 'finished':
      case 'termine': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_consultation':
      case 'en_consultation': return 'En consultation';
      case 'entre': return 'Entré';
      case 'appele': return 'Appelé';
      case 'waiting':
      case 'en_attente': return 'En attente';
      case 'finished':
      case 'termine': return 'Terminé';
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

  const filterDoctors = () => {
    return doctors.filter(doctor => {
      const doctorName = `${doctor.prenom} ${doctor.nom}`.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      if (searchTerm && !doctorName.includes(searchLower)) {
        // Vérifier si le terme de recherche correspond à un patient par téléphone
        const queue = waitingQueues[doctor.id] || [];
        const hasMatchingPatient = queue.some(patient => {
          const patientPhone = patient.patient?.telephone || '';
          return patientPhone.includes(searchTerm);
        });

        if (!hasMatchingPatient) {
          return false;
        }
      }

      return true;
    });
  };

  const filterPatients = (patients) => {
    const active = filterActiveQueueItems(patients);
    const filtered = filterOutPastAppointments(active);
    const finalFiltered = filterOutStuckConsultations(filtered);
    if (filterStatus === 'all') return finalFiltered;
    if (filterStatus === 'urgent') {
      return finalFiltered.filter((patient) => isUrgentQueuePriority(patient.priority));
    }
    return finalFiltered.filter((patient) =>
      matchesQueueFilterStatus(filterStatus, patient.status),
    );
  };

  const getDoctorStats = (doctorId) => {
    const queue = filterActiveQueueItems(waitingQueues[doctorId] || []);
    const filteredQueue = filterPatients(waitingQueues[doctorId] || []);
    const stats = computeQueueStats(queue);

    return {
      total: stats.total,
      waiting: stats.waiting,
      inConsultation: stats.inConsultation,
      inSalle: stats.onBench,
      urgent: stats.urgent,
      filtered: filteredQueue.length,
    };
  };

  const isAppointmentInQueue = (doctorId, appointment) => {
    const queue = waitingQueues[doctorId] || [];
    return queue.some(p => p.patient_id === appointment.patient_id && p.appointment_id === appointment.id);
  };

  // Statistiques globales (patients actifs uniquement)
  const allQueues = filterActiveQueueItems(Object.values(waitingQueues).flat());
  const globalStats = computeQueueStats(allQueues);
  const totalDoctors = filterDoctors().length;
  const totalAppointments = Object.values(appointmentsByDoctor).reduce(
    (acc, arr) => acc + (arr ? arr.length : 0),
    0,
  );
  const totalWaiting = globalStats.onBench;
  const totalInConsult = globalStats.inConsultation;
  const totalUrgent = globalStats.urgent;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des files d'attente...</p>
        </div>
      </div>
    );
  }

  const filteredDoctors = filterDoctors();

  const filterTodayAppointments = (list) =>
    (list || []).filter((appt) => !shouldHidePastAppointment(appt));

  const handleDoctorStatClick = (doctor, queueFilter, event) => {
    event?.stopPropagation?.();
    onDoctorSelect?.(doctor, queueFilter);
  };

  // Calculer les statistiques par médecin pour le tableau récapitulatif
  const doctorStats = doctors.map(doctor => {
    const doctorQueue = filterActiveQueueItems(waitingQueues[doctor.id] || []);
    
    const enAttente = doctorQueue.filter(p => 
      p.status === 'waiting' || 
      p.status === 'en_attente' || 
      p.status === 'present' || 
      p.status === 'arrive'
    ).length;
    
    const enConsultation = doctorQueue.filter(p => 
      p.status === 'in_consultation' || 
      p.status === 'en_consultation'
    ).length;
    
    const total = enAttente + enConsultation;
    
    // Répartition par urgence (sur les patients présents)
    const presentPatients = doctorQueue.filter(p => 
      p.status === 'waiting' || 
      p.status === 'en_attente' || 
      p.status === 'present' || 
      p.status === 'arrive' ||
      p.status === 'in_consultation' || 
      p.status === 'en_consultation'
    );
    
    const tresUrgent = presentPatients.filter(p => p.priority === 'tres_urgente').length;
    const urgent = presentPatients.filter(p => p.priority === 'urgente').length;
    const normal = presentPatients.filter(p => p.priority === 'normale' || !p.priority).length;
    
    // Total du jour : consultations terminées aujourd'hui
    const totalDuJour = (consultationsByDoctor[doctor.id] || []).length;
    
    return {
      medecinId: doctor.id,
      nom: `Dr. ${doctor.prenom} ${doctor.nom}`,
      enAttente,
      enConsultation,
      total,
      totalDuJour,
      urgence: {
        tresUrgent,
        urgent,
        normal
      }
    };
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Vue Globale - Tous les Médecins</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ClickableStatCard
            tone="blue"
            icon={Users}
            label="Médecins"
            value={totalDoctors}
            onClick={() => onDoctorSelect?.(null)}
            title="Voir tous les médecins"
          />
          <ClickableStatCard
            tone="green"
            icon={Calendar}
            label="RDV aujourd'hui"
            value={totalAppointments}
            onClick={onNavigateCalendar}
            title="Ouvrir le calendrier"
          />
          <ClickableStatCard
            tone="yellow"
            icon={Clock}
            label="Salle d'attente"
            value={totalWaiting}
            onClick={onNavigateWaitingRoom}
            title="Ouvrir la salle d'attente"
          />
          <ClickableStatCard
            tone="red"
            icon={AlertTriangle}
            label="Urgences"
            value={totalUrgent}
            onClick={() => onFilterStatus?.('urgent')}
            active={filterStatus === 'urgent'}
            title="Filtrer les urgences"
          />
        </div>
      </div>

      {/* Tableau récapitulatif par médecin */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Médecin</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700" colSpan="2">Présents</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Total</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Total du jour</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700" colSpan="3">Dont (urgence)</th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600">En attente</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600">En consultation</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600 bg-red-200">Très urgent</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600 bg-orange-50">Urgent</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600 bg-green-50">Normal</th>
              </tr>
            </thead>
            <tbody>
              {doctorStats.map((stat) => (
                <tr 
                  key={stat.medecinId} 
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    const doctor = doctors.find(d => d.id === stat.medecinId);
                    if (doctor) onDoctorSelect?.(doctor);
                  }}
                >
                  <td className="py-3 px-4 font-medium text-gray-900">{stat.nom}</td>
                  <td className="text-center py-3 px-4 text-gray-700">{stat.enAttente}</td>
                  <td className="text-center py-3 px-4 text-gray-700">{stat.enConsultation}</td>
                  <td className="text-center py-3 px-4 font-bold text-gray-900">{stat.total}</td>
                  <td className="text-center py-3 px-4 font-bold text-blue-900">{stat.totalDuJour}</td>
                  <td className="text-center py-3 px-4 text-gray-700 bg-red-200">{stat.urgence.tresUrgent}</td>
                  <td className="text-center py-3 px-4 text-gray-700 bg-orange-50">{stat.urgence.urgent}</td>
                  <td className="text-center py-3 px-4 text-gray-700 bg-green-50">{stat.urgence.normal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {doctorStats.length === 0 && (
        <div className="text-center py-12">
          <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Aucun médecin trouvé</p>
        </div>
      )}

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

      {/* Modal de réassignation de médecin */}
      {showReassignModal && selectedPatientForReassign && (
        <DoctorReassignModal
          isOpen={showReassignModal}
          onClose={() => {
            setShowReassignModal(false);
            setSelectedPatientForReassign(null);
          }}
          patient={selectedPatientForReassign}
          currentMedecinId={selectedPatientForReassign.medecin_id}
          onReassignComplete={handleReassignComplete}
        />
      )}
    </div>
  );
};

export default GlobalWaitingQueue;
