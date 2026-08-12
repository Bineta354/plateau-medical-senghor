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
  // Copie non filtrée (tous statuts) de la file du jour par médecin, utilisée
  // uniquement pour distinguer les vrais walk-in (sans RDV) des consultations
  // "orphelines" rattachées à un RDV d'un autre jour — voir doctorStats plus
  // bas (même problème/fix que DoctorSpecificQueue.jsx).
  const [rawWaitingQueuesToday, setRawWaitingQueuesToday] = useState({});
  // RDV du jour par médecin (id, patient_id, priorite) — indépendant de la
  // file d'attente, sert à la fois à réconcilier "Consultations terminées"
  // et à répartir "Dont (urgence)" pour les RDV pas encore arrivés.
  const [appointmentsByDoctorToday, setAppointmentsByDoctorToday] = useState({});
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

      if (!doctors || doctors.length === 0) {
        setWaitingQueues({});
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

      // 1) Récupérer les files d'attente avec jointure sur appointments
      // Scope sur `waiting_queue.created_at` du jour (même logique que
      // DoctorSpecificQueue.jsx / SalleAttentePage.jsx) : sans ça, une ligne
      // jamais clôturée la veille (statut resté "waiting") continue
      // d'apparaître dans la file du jour. Filtrer sur `appointments.date_heure`
      // (ressource embarquée) transforme en plus la jointure en INNER JOIN côté
      // PostgREST, ce qui exclurait à tort toute ligne sans rendez-vous associé.
      const { data: waitingData, error: waitingError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          appointments(date_heure, statut_arrivee, heure_arrivee)
        `)
        .in('medecin_id', medecinIds)
        .gte('created_at', queueTodayStart)
        .lt('created_at', queueTomorrowStart)
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

      // Conserver une copie non filtrée (tous statuts) avant le filtrage actif
      // ci-dessous, pour identifier plus tard les vrais walk-in du jour.
      const rawQueues = { ...queues };

      // 6) Filtrer les patients actifs et exclure ceux avec rendez-vous passés et consultations bloquées
      Object.keys(queues).forEach(doctorId => {
        const activeItems = filterActiveQueueItems(queues[doctorId]);
        const filteredItems = filterOutPastAppointments(activeItems, now);
        const finalFilteredItems = filterOutStuckConsultations(filteredItems, now);
        queues[doctorId] = finalFilteredItems;
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      setWaitingQueues(queues);
      setRawWaitingQueuesToday(rawQueues);

      // 7) Récupérer les consultations du jour pour chaque médecin
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

      // 8) Récupérer les RDV du jour par médecin (indépendamment de la file
      // d'attente) : une consultation "terminée aujourd'hui" (date_consultation)
      // peut être rattachée à un RDV d'un autre jour resté ouvert (RDV de la
      // veille jamais clôturé, consulté après minuit) — consultations.appointment_id
      // n'étant pas fiabilisé, on ne peut pas filtrer dessus directement. On ne
      // garde donc dans doctorStats que les consultations dont le patient a
      // soit un RDV aujourd'hui, soit un passage en file aujourd'hui sans RDV
      // (vrai walk-in) — voir doctorStats plus bas.
      const { data: appointmentsTodayData, error: appointmentsTodayError } = await supabase
        .from('appointments')
        .select('id, patient_id, medecin_id, priorite')
        .in('medecin_id', medecinIds)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString());

      if (appointmentsTodayError) {
        console.error('Erreur RDV du jour:', appointmentsTodayError);
      } else if (appointmentsTodayData) {
        const appointmentsByDoc = {};
        appointmentsTodayData.forEach(appointment => {
          const key = appointment.medecin_id;
          if (!appointmentsByDoc[key]) appointmentsByDoc[key] = [];
          appointmentsByDoc[key].push(appointment);
        });
        setAppointmentsByDoctorToday(appointmentsByDoc);
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

    // Utiliser la table consultations pour les consultations terminées, en
    // excluant les orphelines (RDV d'un autre jour resté ouvert) — voir le
    // commentaire de l'étape 8 dans fetchAllData.
    const doctorConsultations = consultationsByDoctor[doctor.id] || [];
    const doctorAppointmentsToday = appointmentsByDoctorToday[doctor.id] || [];
    const todayApptPatientIds = new Set(doctorAppointmentsToday.map(a => a.patient_id));
    const todayWalkinPatientIds = new Set(
      (rawWaitingQueuesToday[doctor.id] || [])
        .filter(q => !q.appointment_id)
        .map(q => q.patient_id)
    );
    const finishedConsultations = doctorConsultations.filter(c =>
      (c.statut === 'terminee' ||
        c.statut === 'termine' ||
        c.statut === 'finished' ||
        c.statut === 'completed') &&
      (todayApptPatientIds.has(c.patient_id) || todayWalkinPatientIds.has(c.patient_id))
    );
    const terminees = finishedConsultations.length;

    // "Total du jour" doit s'incrémenter dès la création d'un RDV,
    // indépendamment de la présence du patient (pas seulement une fois
    // arrivé/en consultation/terminé) — donc basé sur le nombre de RDV
    // planifiés aujourd'hui, plus les vrais walk-in ajoutés en file sans RDV.
    const todayApptCount = doctorAppointmentsToday.length;
    const walkinOnlyPatientIds = Array.from(todayWalkinPatientIds).filter(
      patientId => !todayApptPatientIds.has(patientId)
    );
    const total = todayApptCount + walkinOnlyPatientIds.length;

    // Répartition par urgence : même raisonnement que "Total du jour" — un
    // RDV pas encore arrivé doit compter dans sa case d'urgence dès sa
    // création (priorité du RDV), pas seulement une fois le patient confirmé
    // présent (waiting_queue.priority) ou la consultation terminée
    // (consultations.niveau_urgence). On part donc des RDV du jour (par
    // priorite), on retire ceux déjà comptés via la file active ou les
    // consultations terminées pour ne pas les compter deux fois, et on ajoute
    // leur contribution "pas encore arrivé" par tranche d'urgence.
    const presentPatients = activeDoctorQueue;
    const alreadyCountedPatientIds = new Set([
      ...presentPatients.map(p => p.patient_id),
      ...finishedConsultations.map(c => c.patient_id),
    ]);
    const notYetArrivedAppointments = doctorAppointmentsToday.filter(
      a => !alreadyCountedPatientIds.has(a.patient_id)
    );

    const tresUrgent =
      presentPatients.filter(p => p.priority === 'tres_urgente' || p.appointment?.priorite === 'tres_urgente').length +
      finishedConsultations.filter(c => c.niveau_urgence === 'tres_urgente').length +
      notYetArrivedAppointments.filter(a => a.priorite === 'tres_urgente').length;
    const urgent =
      presentPatients.filter(p => p.priority === 'urgente' || p.appointment?.priorite === 'urgente').length +
      finishedConsultations.filter(c => c.niveau_urgence === 'urgente').length +
      notYetArrivedAppointments.filter(a => a.priorite === 'urgente').length;
    const normal =
      presentPatients.filter(p => {
        const priority = p.priority || p.appointment?.priorite;
        return priority === 'normale' || priority === 'normal' || !priority;
      }).length +
      finishedConsultations.filter(c => !c.niveau_urgence || c.niveau_urgence === 'normale').length +
      notYetArrivedAppointments.filter(a => !a.priorite || a.priorite === 'normale' || a.priorite === 'normal').length;

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

  // "RDV aujourd'hui" doit être le total tous médecins confondus, cohérent
  // avec la colonne "Total du jour" du tableau récapitulatif ci-dessous
  // (même logique que le fix appliqué à DoctorSpecificQueue.jsx : enAttente +
  // enConsultation + terminées, pas un simple count() sur `appointments`).
  const totalRdvAujourdhui = doctorStats.reduce((acc, stat) => acc + stat.totalDuJour, 0);

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
            value={totalRdvAujourdhui}
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
