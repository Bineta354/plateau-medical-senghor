import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Stethoscope,
  Clock,
  AlertTriangle,
  Users,
  Calendar,
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
import KpiCard from '../common/KpiCard';

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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consultations'
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

      // 1) Récupérer les files d'attente avec jointure sur appointments (tous les rendez-vous du jour)
      const { data: waitingData, error: waitingError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointments(date_heure, statut_arrivee, heure_arrivee)
        `)
        .in('medecin_id', medecinIds)
        .gte('appointments.date_heure', queueTodayStart)
        .lt('appointments.date_heure', queueTomorrowStart)
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

  // Calculer les statistiques par médecin pour le tableau récapitulatif
  const doctorStatsRaw = filteredDoctors.map(doctor => {
    // Utiliser waiting_queue pour les patients en attente/en cours. On ne
    // s'appuie plus sur une liste de statuts codée en dur ici : le workflow a
    // plus d'états que "waiting/present/arrive" (authorized, called, appele,
    // en_route, medecin_pret...) — un patient dans un de ces statuts ne
    // comptait avant dans NI "En attente" NI "En consultation", et
    // disparaissait donc du total. Le découpage à retenir n'est que celui du
    // statut de la consultation : en attente de consultation / en
    // consultation / terminée — pas "combien sont physiquement dans la salle
    // d'attente". `isOnWaitingBench` / `isInConsultationQueueStatus` (déjà
    // utilisées par les KPI de cette page) forment une partition complète des
    // statuts actifs, donc enAttente + enConsultation = tous les présents.
    const doctorQueue = waitingQueues[doctor.id] || [];
    const activeDoctorQueue = filterActiveQueueItems(doctorQueue);

    const enAttente = activeDoctorQueue.filter(p => isOnWaitingBench(p.status)).length;

    const enConsultation = activeDoctorQueue.filter(p => isInConsultationQueueStatus(p.status)).length;

    // Utiliser la table consultations pour les consultations terminées
    const doctorConsultations = consultationsByDoctor[doctor.id] || [];
    const finishedConsultations = doctorConsultations.filter(c =>
      c.statut === 'terminee' ||
      c.statut === 'termine' ||
      c.statut === 'finished' ||
      c.statut === 'completed'
    );
    const terminees = finishedConsultations.length;

    const total = enAttente + enConsultation + terminees;

    // Répartition par urgence : "Dont (urgence)" doit décomposer le même
    // total que la colonne "Total du jour", donc elle doit couvrir les MÊMES
    // patients — présents (waiting_queue.priority) ET terminés
    // (consultations.niveau_urgence, copié depuis waiting_queue.priority à la
    // création de la consultation). Se limiter aux présents faisait que
    // Très urgent + Urgent + Normal ne retombait jamais sur Total du jour dès
    // qu'il y avait au moins une consultation terminée.
    const presentPatients = activeDoctorQueue;

    const tresUrgent =
      presentPatients.filter(p => p.priority === 'tres_urgente' || p.appointment?.priorite === 'tres_urgente').length +
      finishedConsultations.filter(c => c.niveau_urgence === 'tres_urgente').length;
    const urgent =
      presentPatients.filter(p => p.priority === 'urgente' || p.appointment?.priorite === 'urgente').length +
      finishedConsultations.filter(c => c.niveau_urgence === 'urgente').length;
    const normal =
      presentPatients.filter(p => {
        const priority = p.priority || p.appointment?.priorite;
        return priority === 'normale' || priority === 'normal' || !priority;
      }).length +
      finishedConsultations.filter(c => !c.niveau_urgence || c.niveau_urgence === 'normale').length;

    // Total du jour : somme de toutes les consultations (attente + en cours + terminées)
    const totalDuJour = total;


    return {
      medecinId: doctor.id,
      nom: `Dr. ${doctor.prenom} ${doctor.nom}`,
      enAttente,
      enConsultation,
      terminees,
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

  const doctorStats = doctorStatsSorted;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Vue Globale - Tous les Médecins</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            tone="blue"
            label="Médecins"
            value={totalDoctors}
            onClick={() => onDoctorSelect?.(null)}
            hoverMessage="Voir tous les médecins"
          />
          <KpiCard
            icon={Calendar}
            tone="green"
            label="RDV aujourd'hui"
            value={totalAppointments}
            onClick={onNavigateCalendar}
            hoverMessage="Ouvrir le calendrier"
          />
          <KpiCard
            icon={Clock}
            tone="yellow"
            label="Salle d'attente"
            value={totalWaiting}
            onClick={onNavigateWaitingRoom}
            hoverMessage="Ouvrir la salle d'attente"
          />
          <KpiCard
            icon={AlertTriangle}
            tone="red"
            label="Urgences"
            value={totalUrgent}
            onClick={() => onFilterStatus?.('urgent')}
            active={filterStatus === 'urgent'}
            hoverMessage="Filtrer les urgences"
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
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Consultations terminées</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Total du jour</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700" colSpan="3">Dont (urgence)</th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600">En attente</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600">En consultation</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-600"></th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-800 bg-red-200">Très urgent</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-800 bg-orange-200">Urgent</th>
                <th className="text-center py-2 px-4 text-sm font-medium text-gray-800 bg-green-200">Normal</th>
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
                  <td className="text-center py-3 px-4 text-gray-700">{stat.terminees}</td>
                  <td className="text-center py-3 px-4 font-bold text-blue-900">{stat.totalDuJour}</td>
                  <td className="text-center py-3 px-4 font-bold text-gray-800 bg-red-200">{stat.urgence.tresUrgent}</td>
                  <td className="text-center py-3 px-4 font-bold text-gray-800 bg-orange-200">{stat.urgence.urgent}</td>
                  <td className="text-center py-3 px-4 font-bold text-gray-800 bg-green-200">{stat.urgence.normal}</td>
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
    </div>
  );
};

export default GlobalWaitingQueue;
