import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Stethoscope,
  Clock,
  AlertTriangle,
  Users,
  Calendar,
  CheckCircle,
  ChevronRight,
  Moon
} from 'lucide-react';
import {
  computeQueueStats,
  filterActiveQueueItems,
  hasPastAppointment,
  filterOutPastAppointments,
  isStuckInConsultation,
  filterOutStuckConsultations,
  isOnWaitingBench,
  isInConsultationQueueStatus,
} from '../../utils/waitingQueueStatus';
import ClickableStatCard from '../common/ClickableStatCard';

const GlobalWaitingQueue = ({
  doctors,
  searchTerm,
  filterStatus = 'all',
  onDoctorSelect,
  onNavigateCalendar,
  onNavigateWaitingRoom,
  onFilterStatus,
}) => {
  const [waitingQueues, setWaitingQueues] = useState({});
  const [appointmentsByDoctor, setAppointmentsByDoctor] = useState({});
  const [consultationsByDoctor, setConsultationsByDoctor] = useState({});
  const [loading, setLoading] = useState(true);

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

  // Statistiques globales (patients actifs uniquement)
  const allQueues = filterActiveQueueItems(Object.values(waitingQueues).flat());
  const globalStats = computeQueueStats(allQueues);
  const totalDoctors = filterDoctors().length;
  const totalAppointments = Object.values(appointmentsByDoctor).reduce(
    (acc, arr) => acc + (arr ? arr.length : 0),
    0,
  );
  const totalWaiting = globalStats.onBench;
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

  const getInitials = (doctor) =>
    `${doctor.prenom?.[0] || ''}${doctor.nom?.[0] || ''}`.toUpperCase() || '?';

  // Calculer les statistiques par médecin pour le tableau récapitulatif
  const doctorStatsRaw = filteredDoctors.map(doctor => {
    // On réutilise les mêmes fonctions de classification que les compteurs globaux
    // (computeQueueStats / isOnWaitingBench) pour que la somme par médecin
    // corresponde toujours exactement aux cartes du haut ("Salle d'attente", "Urgences").
    const doctorQueue = filterActiveQueueItems(waitingQueues[doctor.id] || []);

    const enAttente = doctorQueue.filter(p => isOnWaitingBench(p.status)).length;
    const enConsultation = doctorQueue.filter(p => isInConsultationQueueStatus(p.status)).length;
    const total = enAttente + enConsultation;

    // Répartition par urgence (sur tous les patients actifs du médecin)
    const tresUrgent = doctorQueue.filter(p => p.priority === 'tres_urgente').length;
    const urgent = doctorQueue.filter(p => p.priority === 'urgente').length;
    const normal = doctorQueue.filter(p => p.priority === 'normale' || !p.priority).length;

    // Total du jour : consultations terminées aujourd'hui
    const totalDuJour = (consultationsByDoctor[doctor.id] || []).length;

    return {
      medecinId: doctor.id,
      initiales: getInitials(doctor),
      nom: `Dr. ${doctor.prenom} ${doctor.nom}`,
      specialite: doctor.specialite || null,
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

  // Priorité au médecin qui a le plus besoin d'attention : très urgent > urgent > total de patients,
  // puis les médecins sans aucun patient sont relégués en bas et grisés.
  const doctorStatsSorted = [...doctorStatsRaw].sort((a, b) => {
    if (a.urgence.tresUrgent !== b.urgence.tresUrgent) return b.urgence.tresUrgent - a.urgence.tresUrgent;
    if (a.urgence.urgent !== b.urgence.urgent) return b.urgence.urgent - a.urgence.urgent;
    if (a.total !== b.total) return b.total - a.total;
    return a.nom.localeCompare(b.nom);
  });

  // Si on vient de cliquer sur la carte "Urgences", ne garder que les médecins concernés
  const doctorStats = filterStatus === 'urgent'
    ? doctorStatsSorted.filter((s) => s.urgence.tresUrgent > 0 || s.urgence.urgent > 0)
    : doctorStatsSorted;

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
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
          <h3 className="text-sm font-semibold text-gray-700">Par médecin</h3>
          {filterStatus === 'urgent' && (
            <button
              type="button"
              onClick={() => onFilterStatus?.('all')}
              className="text-xs font-medium text-medical-primary hover:text-medical-primary-dark"
            >
              Voir tous les médecins ×
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/60">
                <th className="text-left py-3 px-5 font-semibold text-gray-600">Médecin</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Attente</span>
                </th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600">
                  <span className="inline-flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" /> Consult.</span>
                </th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600">Total présent</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600">
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Vus aujourd'hui</span>
                </th>
                <th className="text-center py-3 px-5 font-semibold text-gray-600">Urgences</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doctorStats.map((stat) => {
                const isEmpty = stat.total === 0;
                const hasTresUrgent = stat.urgence.tresUrgent > 0;
                return (
                  <tr
                    key={stat.medecinId}
                    className={`group cursor-pointer transition-colors ${
                      hasTresUrgent
                        ? 'bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-500'
                        : isEmpty
                          ? 'hover:bg-gray-50 opacity-60'
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      const doctor = doctors.find(d => d.id === stat.medecinId);
                      if (doctor) onDoctorSelect?.(doctor);
                    }}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-medical-primary/10 text-medical-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {stat.initiales}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{stat.nom}</p>
                          {stat.specialite && (
                            <p className="text-xs text-gray-500 truncate">{stat.specialite}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-3">
                      {stat.enAttente > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                          {stat.enAttente}
                        </span>
                      ) : (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-3">
                      {stat.enConsultation > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {stat.enConsultation}
                        </span>
                      ) : (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-3 font-bold text-gray-900">
                      {isEmpty ? <span className="font-normal text-gray-400">Aucun patient</span> : stat.total}
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="font-semibold text-gray-700">{stat.totalDuJour}</span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          title="Très urgent"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            stat.urgence.tresUrgent > 0 ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {stat.urgence.tresUrgent > 0 && <AlertTriangle className="w-3 h-3" />}
                          {stat.urgence.tresUrgent}
                        </span>
                        <span
                          title="Urgent"
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            stat.urgence.urgent > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {stat.urgence.urgent}
                        </span>
                        <span
                          title="Normal"
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            stat.urgence.normal > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {stat.urgence.normal}
                        </span>
                      </div>
                    </td>
                    <td className="pr-4">
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-medical-primary transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {doctorStats.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl mt-4">
          {filterStatus === 'urgent' ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune urgence en ce moment</p>
            </>
          ) : (
            <>
              <Moon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun médecin trouvé</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalWaitingQueue;
