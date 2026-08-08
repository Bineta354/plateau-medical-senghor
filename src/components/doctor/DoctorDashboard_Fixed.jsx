import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { sendNotification, NOTIFICATION_TYPES } from '../../lib/notifications';
import { NewAppointmentModal } from '../rendez-vous/NewAppointmentModal';
import {
  Users,
  Clock,
  Calendar,
  CalendarCheck,
  Bell,
  Check,
  User,
  UserCheck,
  Stethoscope,
  AlertTriangle,
  Activity,
  Plus,
  X,
  FolderOpen,
  ChevronDown,
  Lock
} from 'lucide-react';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [selectedCurrentPatientId, setSelectedCurrentPatientId] = useState(null); // Nouveau: patient actuel sélectionné manuellement
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [stats, setStats] = useState({
    totalWaiting: 0,
    consultationsFinished: 0
  });
  const [loading, setLoading] = useState(true);
  const [showCreateRdvModal, setShowCreateRdvModal] = useState(false);

  useEffect(() => {
    if (userProfile?.id) {
      fetchDashboardData();
      
      // Subscription temps réel
      const channel = supabase.channel('doctor_dashboard')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'waiting_queue',
          filter: `medecin_id=eq.${userProfile.id}`
        }, () => {
          fetchDashboardData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userProfile?.id]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Récupérer la file d'attente du médecin
      const { data: queueData, error: queueError } = await supabase
        .from('v_waiting_queue_complete')
        .select('*')
        .eq('medecin_id', userProfile.id)
        .in('status', ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation'])
        .order('priorite_calculee', { ascending: true })
        .order('order_position', { ascending: true });

      if (queueError) throw queueError;

      const appointmentIds = Array.from(new Set((queueData || [])
        .filter(item => item.appointment_id)
        .map(item => item.appointment_id)));

      let linkedAppointments = [];
      if (appointmentIds.length > 0) {
        const { data: linkedData, error: linkedError } = await supabase
          .from('appointments')
          .select('id, date_heure, motif, type_rdv, patient_id')
          .in('id', appointmentIds);

        if (linkedError) {
          console.warn('Erreur récupération appointments liés:', linkedError);
        } else {
          linkedAppointments = linkedData || [];
        }
      }

      const enrichedQueue = (queueData || []).map(item => {
        const matchingAppointment = linkedAppointments.find(appt => appt.id === item.appointment_id);
        return {
          ...item,
          rdv_motif: matchingAppointment?.motif || item.motif_consultation || item.rdv_motif || '',
          rdv_type: matchingAppointment?.type_rdv || item.type_rdv || item.rdv_type || '',
          rdv_date_heure: matchingAppointment?.date_heure || item.rdv_date_heure || null
        };
      });

      setWaitingQueue(enrichedQueue);

      // Récupérer les RDV du jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(nom, prenom, telephone),
          waiting_queue!left(id, status, arrived_at)
        `)
        .eq('medecin_id', userProfile.id)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure');

      if (appointmentsError) throw appointmentsError;
      setTodayAppointments(appointmentsData || []);

      // Consultations terminées aujourd'hui — requête séparée et volontaire :
      // `queueData` ci-dessus est filtré sur les statuts actifs uniquement
      // (.in('status', [...]) ne contient pas 'termine'), donc un filtre
      // `q.status === 'termine'` dessus ne matchait jamais rien et le
      // compteur "Terminées" du dashboard restait bloqué à 0. Voir
      // FIX_ETAPE_2_MEDECIN.md point 1.
      const { count: finishedCount, error: finishedError } = await supabase
        .from('waiting_queue')
        .select('id', { count: 'exact', head: true })
        .eq('medecin_id', userProfile.id)
        .eq('status', 'termine')
        .gte('updated_at', today.toISOString())
        .lt('updated_at', tomorrow.toISOString());

      if (finishedError) {
        console.warn('Erreur récupération consultations terminées:', finishedError);
      }

      // Calculer les statistiques
      const queueStats = {
        totalWaiting: queueData?.filter(q => ['waiting', 'present', 'authorized'].includes(q.status)).length || 0,
        consultationsFinished: finishedCount || 0
      };
      setStats(queueStats);

    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientAction = async (patientId, action) => {
    try {
      const patient = waitingQueue.find(p => p.id === patientId);
      const patientName = patient ? `${patient.patient_prenom} ${patient.patient_nom}` : 'Patient';

      switch (action) {
        case 'receive':
          // Nouveau workflow simplifié : Recevoir le patient
          const patient = waitingQueue.find(p => p.id === patientId || p.waiting_queue_id === patientId);
          if (!patient) {
            unifiedNotificationService.error('Patient non trouvé ou déjà en cours de traitement');
            break;
          }

          // Réinitialiser les autres patients du médecin à 'waiting' avant de démarrer la consultation
          // pour garantir qu'un seul patient est en consultation à la fois
          try {
            await supabase
              .from('waiting_queue')
              .update({ 
                status: 'waiting',
                updated_at: new Date().toISOString()
              })
              .eq('medecin_id', userProfile.id)
              .neq('id', patientId)
              .in('status', ['authorized', 'en_route', 'present', 'arrive']);
          } catch (error) {
            console.error('Erreur lors de la réinitialisation des autres patients:', error);
          }

          console.log('userProfile complet:', JSON.stringify(userProfile));
          console.log('userProfile.id:', userProfile.id, 'Type:', typeof userProfile.id);
          
          const { data: receiveData, error: receiveError } = await supabase.rpc('medecin_recoit_patient_simplifie', {
            p_waiting_queue_id: patientId,
            p_medecin_id: userProfile.id
          });
          
          console.log('receiveData complet:', JSON.stringify(receiveData));
          console.log('receiveError complet:', JSON.stringify(receiveError));
          
          if (receiveError) throw receiveError;
          
          if (receiveData?.success) {
            // Fixer ce patient comme patient actuel
            setSelectedCurrentPatientId(patientId);
            localStorage.setItem(`doctor_${userProfile?.id}_current_patient`, patientId);
            unifiedNotificationService.success(receiveData.message);

            // Prévenir la secrétaire (toutes les secrétaires actives du cabinet) du patient à envoyer
            try {
              const receivedPatientName = `${patient.patient_prenom || ''} ${patient.patient_nom || ''}`.trim() || 'Patient';
              await sendNotification(
                NOTIFICATION_TYPES.PATIENT_CALLED,
                userProfile.id,
                null, // envoyé à toutes les secrétaires actives du cabinet
                null,
                receivedPatientName,
                { waitingQueueId: patientId, patientId: patient.patient_id }
              );
            } catch (notifError) {
              console.error('Erreur lors de l\'envoi de la notification à la secrétaire:', notifError);
            }
          } else {
            unifiedNotificationService.error(receiveData.error || 'Erreur lors de la réception du patient');
          }
          break;

        case 'start':
          // Commencer la consultation (patient doit être en_route)
          try {
            // Mettre à jour le statut du patient
            const { error: startError } = await supabase
              .from('waiting_queue')
              .update({ 
                status: 'in_consultation',
                updated_at: new Date().toISOString()
              })
              .eq('id', patientId)
              .eq('medecin_id', userProfile.id);
            if (startError) throw startError;
            
            // Trouver ou créer une consultation et rediriger directement
            const { data: wq, error: wqErr } = await supabase
              .from('waiting_queue')
              .select('patient_id, medecin_id, appointment_id, motif_consultation, priority')
              .eq('id', patientId)
              .single();
            
            if (wqErr) throw wqErr;
            
            if (wq?.patient_id && wq?.medecin_id) {
              // Chercher consultation existante aujourd'hui
              const startOfDay = new Date();
              startOfDay.setHours(0,0,0,0);
              const { data: existing, error: findErr } = await supabase
                .from('consultations')
                .select('id, appointment_id, motif_consultation, motif')
                .eq('patient_id', wq.patient_id)
                .eq('medecin_id', wq.medecin_id)
                .gte('date_consultation', startOfDay.toISOString())
                .in('statut', ['en_cours','en_attente'])
                .order('date_consultation', { ascending: false })
                .limit(1);
              
              if (findErr) throw findErr;
              const existingConsultation = existing && existing.length > 0 ? existing[0] : null;
              let consultationId = existingConsultation?.id || null;

              if (consultationId && (wq.appointment_id || wq.motif_consultation) && (!existingConsultation.appointment_id || !existingConsultation.motif_consultation)) {
                await supabase
                  .from('consultations')
                  .update({
                    appointment_id: existingConsultation.appointment_id || wq.appointment_id || null,
                    motif_consultation: existingConsultation.motif_consultation || existingConsultation.motif || wq.motif_consultation || null,
                    motif: existingConsultation.motif || existingConsultation.motif_consultation || wq.motif_consultation || null
                  })
                  .eq('id', consultationId);
              }
              
              // Créer une consultation si elle n'existe pas
              if (!consultationId) {
                const patientData = waitingQueue.find(p => p.id === patientId);
                const { data: created, error: createErr } = await supabase
                  .from('consultations')
                  .insert({
                    patient_id: wq.patient_id,
                    medecin_id: wq.medecin_id,
                    date_consultation: new Date().toISOString(),
                    appointment_id: wq.appointment_id || null,
                    motif_consultation: patientData?.rdv_motif || patientData?.motif_consultation || wq.motif_consultation || null,
                    motif: patientData?.rdv_motif || patientData?.motif_consultation || wq.motif_consultation || null,
                    statut: 'en_cours',
                    // Copié depuis waiting_queue.priority (même échelle normale/urgente/tres_urgente)
                    // pour pouvoir ventiler les consultations terminées par urgence plus tard.
                    niveau_urgence: patientData?.priority || wq.priority || 'normale'
                  })
                  .select('id')
                  .single();
                
                if (createErr) throw createErr;
                consultationId = created.id;
              }

              // Redirection vers la consultation
              const qs = `?from=workflow&waiting_queue_id=${patientId}`;
              navigate(`/consultation/${consultationId}${qs}`);
              return; // Ne pas appeler fetchDashboardData() car on redirige
            }
          } catch (e) {
            console.error('Erreur lors du démarrage de la consultation:', e);
            unifiedNotificationService.error('Erreur lors du démarrage de la consultation: ' + (e?.message || e));
          }
          break;

        case 'finish':
          // Terminer la consultation avec notification à la secrétaire
          const { data: finishData, error: finishError } = await supabase.rpc('medecin_termine_consultation', {
            p_waiting_queue_id: patientId,
            p_medecin_id: userProfile.id
          });
          if (finishError) throw finishError;
          
          if (finishData?.success) {
            unifiedNotificationService.success(finishData.message);
          } else {
            unifiedNotificationService.error(finishData.error || 'Erreur lors de la fin de consultation');
          }
          break;


        default:
          console.warn('Action non reconnue:', action);
      }

      // Actualiser les données
      fetchDashboardData();
    } catch (error) {
      console.error('Erreur lors de l\'action patient:', error);
      console.error('Détails erreur:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      });
      
      // Formatage du message d'erreur
      let errorMessage = 'Erreur lors de l\'action patient';
      
      if (error?.message) {
        errorMessage = `Erreur: ${error.message}`;
      } else if (error?.code) {
        errorMessage = `Erreur ${error.code}: ${error.details || 'Erreur inconnue'}`;
      } else if (typeof error === 'string') {
        errorMessage = `Erreur: ${error}`;
      } else if (error?.error_description) {
        errorMessage = `Erreur: ${error.error_description}`;
      }
      
      // Messages d'erreur spécifiques selon le code
      if (error?.code === '42501') {
        errorMessage = 'Permissions insuffisantes. Contactez l\'administrateur.';
      } else if (error?.code === '23503') {
        errorMessage = 'Référence invalide. Vérifiez les données.';
      } else if (error?.message?.includes('RLS')) {
        errorMessage = 'Problème de sécurité. Veuillez vous reconnecter.';
      } else if (error?.message?.includes('function') && error?.message?.includes('does not exist')) {
        errorMessage = 'Fonction base de données manquante. Contactez l\'administrateur.';
      }
      
      unifiedNotificationService.error(errorMessage);
    }
  };

  // Logique de sélection du patient actuel améliorée
  const currentPatient = React.useMemo(() => {
    console.log('Recalcul du patient actuel - selectedCurrentPatientId:', selectedCurrentPatientId);
    console.log('File d\'attente pour calcul:', waitingQueue.length, 'patients');
    
    // Si un patient est sélectionné manuellement, le prioriser
    if (selectedCurrentPatientId) {
      const manuallySelected = waitingQueue.find(p => {
        const match = String(p.id) === String(selectedCurrentPatientId) || 
                     String(p.waiting_queue_id) === String(selectedCurrentPatientId);
        const validStatus = ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status);
        return match && validStatus;
      });
      
      if (manuallySelected) {
        console.log('Patient sélectionné manuellement trouvé:', manuallySelected);
        return manuallySelected;
      } else {
        console.log('Patient sélectionné manuellement non trouvé ou statut invalide');
        // NE PAS nettoyer automatiquement - garder la sélection même si le patient n'est plus dans la file
        // Cela évite les changements automatiques indésirables
        return null;
      }
    }
    
    // Sinon, utiliser la logique automatique
    const inConsultation = waitingQueue.find(p => p.status === 'in_consultation');
    if (inConsultation) {
      console.log('Patient en consultation (auto):', inConsultation);
      return inConsultation;
    }
    
    // UN SEUL patient disponible à la fois
    const available = waitingQueue.find(p => ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'arrive'].includes(p.status));
    console.log('Patient disponible (auto):', available);
    return available;
  }, [selectedCurrentPatientId, waitingQueue, userProfile?.id]);

  // Pendant qu'un patient est en consultation, le "patient actuel" reste verrouillé
  // dessus : impossible de changer la sélection (dropdown ou clic dans la salle
  // d'attente) tant que la consultation n'est pas terminée.
  const isLockedInConsultation = currentPatient?.status === 'in_consultation';

  // Fonction pour sélectionner manuellement un patient actuel
  const handleSelectCurrentPatient = async (patientId) => {
    console.log('Sélection manuelle du patient actuel:', patientId);
    console.log('PatientId reçu:', patientId, 'Type:', typeof patientId);
    console.log('File d\'attente actuelle:', waitingQueue);
    
    if (patientId) {
      // Vérifier que le patient existe
      const patient = waitingQueue.find(p => 
        String(p.id) === String(patientId) || String(p.waiting_queue_id) === String(patientId)
      );
      if (!patient) {
        unifiedNotificationService.error('Patient non trouvé dans la file d\'attente');
        return;
      }
      
      // Mettre à jour la base de données : réinitialiser les autres patients du médecin à 'waiting'
      // pour garantir qu'un seul patient peut être "actuel" à la fois
      try {
        await supabase
          .from('waiting_queue')
          .update({ 
            status: 'waiting',
            updated_at: new Date().toISOString()
          })
          .eq('medecin_id', userProfile.id)
          .neq('id', patientId)
          .in('status', ['authorized', 'en_route', 'present', 'arrive']);
      } catch (error) {
        console.error('Erreur lors de la réinitialisation des autres patients:', error);
      }
      
      // Mettre à jour l'état immédiatement
      setSelectedCurrentPatientId(patientId);
      localStorage.setItem(`doctor_${userProfile?.id}_current_patient`, patientId);
      console.log('Patient trouvé pour sélection:', patient);
      // Pas de toast/son ici : la sélection est une action fréquente et silencieuse,
      // le badge "ACTUEL" sur la carte suffit comme retour visuel.
    } else {
      setSelectedCurrentPatientId(null);
      localStorage.removeItem(`doctor_${userProfile?.id}_current_patient`);
    }
    
    // Forcer une mise à jour de l'interface
    setTimeout(() => {
      console.log('Patient actuel après sélection:', selectedCurrentPatientId);
    }, 100);
  };

  const handleFocusPatient = (patientId) => {
    handleSelectCurrentPatient(patientId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isCurrentPatient = (patient) => {
    if (!currentPatient) return false;
    if (patient?.id != null && String(patient.id) === String(currentPatient.id)) return true;
    return patient?.waiting_queue_id != null && currentPatient?.waiting_queue_id != null &&
      String(patient.waiting_queue_id) === String(currentPatient.waiting_queue_id);
  };
  
  // Restaurer la sélection depuis le localStorage au chargement
  useEffect(() => {
    if (userProfile?.id && waitingQueue.length > 0 && !selectedCurrentPatientId) {
      const savedPatientId = localStorage.getItem(`doctor_${userProfile.id}_current_patient`);
      console.log('Tentative de restauration depuis localStorage:', savedPatientId);
      
      if (savedPatientId) {
        // Vérifier que le patient existe toujours dans la file d'attente
        const patientExists = waitingQueue.find(p => {
          const match = String(p.id) === String(savedPatientId) || String(p.waiting_queue_id) === String(savedPatientId);
          const validStatus = ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status);
          return match && validStatus;
        });
        
        if (patientExists) {
          console.log('🔄 Sélection patient restaurée depuis localStorage:', savedPatientId);
          setSelectedCurrentPatientId(savedPatientId);
        } else {
          console.log('Patient sauvegardé non trouvé, nettoyage localStorage');
          localStorage.removeItem(`doctor_${userProfile.id}_current_patient`);
        }
      }
    }
  }, [userProfile?.id, waitingQueue.length]);

  // Repli automatique : si le patient actuellement sélectionné (reçu / en consultation)
  // sort de la file active (consultation terminée, remis en attente...), on efface la
  // sélection pour repasser en mode "Auto (par défaut)". Le memo currentPatient affichera
  // alors directement le prochain patient de la salle d'attente avec le bouton
  // "Recevoir ce patient", sans que le médecin ait à sélectionner manuellement.
  useEffect(() => {
    if (!selectedCurrentPatientId || loading) return;

    const stillValid = waitingQueue.some(p => {
      const match = String(p.id) === String(selectedCurrentPatientId) ||
                    String(p.waiting_queue_id) === String(selectedCurrentPatientId);
      const validStatus = ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status);
      return match && validStatus;
    });

    if (!stillValid) {
      console.log('Patient actuel sorti de la file active (terminé) — retour au mode automatique');
      setSelectedCurrentPatientId(null);
      localStorage.removeItem(`doctor_${userProfile?.id}_current_patient`);
    }
  }, [waitingQueue, loading, selectedCurrentPatientId, userProfile?.id]);

  // Debug: Log des changements d'état
  useEffect(() => {
    console.log('selectedCurrentPatientId changé:', selectedCurrentPatientId);
  }, [selectedCurrentPatientId]);
  
  useEffect(() => {
    console.log('currentPatient changé:', currentPatient);
  }, [currentPatient]);

  // Badge de statut pour le widget "RDV du jour" — harmonisé avec le pattern
  // déjà utilisé côté secrétaire (Prise de Rendez-vous). `appointments.statut`
  // seul ne suffit pas : il reste à 'arrive' pendant toute la consultation
  // (medecin_recoit_patient_simplifie ne touche que waiting_queue.status),
  // donc on regarde d'abord l'entrée waiting_queue liée pour détecter
  // "En consultation". Voir FIX_ETAPE_2_MEDECIN.md point 2.
  const getAppointmentStatusBadge = (appointment) => {
    const linkedQueue = Array.isArray(appointment.waiting_queue)
      ? appointment.waiting_queue[0]
      : appointment.waiting_queue;

    if (linkedQueue?.status === 'in_consultation') {
      return { label: 'En consultation', color: 'bg-green-100 text-green-800' };
    }

    const statusConfig = {
      confirme: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800' },
      en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      arrive: { label: 'Arrivé', color: 'bg-orange-100 text-orange-800' },
      termine: { label: 'Terminée', color: 'bg-gray-200 text-gray-700' },
      annule: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
      non_honore: { label: 'Non honoré', color: 'bg-red-100 text-red-800' }
    };

    return statusConfig[appointment.statut] || { label: appointment.statut, color: 'bg-gray-100 text-gray-800' };
  };

  // Badge de statut pour le mini-roster "Salle d'attente" — mêmes teintes pastel
  // (emerald/amber/gray) que le reste de la refonte (voir FichePatientOnly.jsx).
  const queueStatusBadge = {
    waiting: { label: 'En attente', color: 'bg-gray-100 text-gray-600' },
    present: { label: 'Arrivé', color: 'bg-amber-50 text-amber-700' },
    arrive: { label: 'Arrivé', color: 'bg-amber-50 text-amber-700' },
    authorized: { label: 'Autorisé', color: 'bg-blue-50 text-blue-700' },
    medecin_pret: { label: 'Médecin prêt', color: 'bg-blue-50 text-blue-700' },
    en_route: { label: 'Appelé', color: 'bg-purple-50 text-purple-700' },
    in_consultation: { label: 'En consultation', color: 'bg-emerald-50 text-emerald-700' },
  };
  const getQueueStatusBadge = (status) => queueStatusBadge[status] || { label: status, color: 'bg-gray-100 text-gray-600' };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-medical-primary mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const inConsultationCount = waitingQueue.filter(p => p.status === 'in_consultation').length;
  const newlyArrivedCount = waitingQueue.filter(p => p.status === 'present' || p.status === 'arrive').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-6 flex items-start justify-between gap-5 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold text-gray-900 tracking-tight">
              Bonjour, Dr. {userProfile?.prenom} {userProfile?.nom}
            </h1>
            <p className="text-[13.5px] text-gray-500 mt-1.5">
              {userProfile?.specialite ? `${userProfile.specialite} · ` : ''}
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} · {new Date().toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreateRdvModal(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium bg-medical-primary text-white rounded-xl hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau rendez-vous
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-medical-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-medical-primary" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">En attente</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalWaiting}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">En consultation</p>
              <p className="text-2xl font-semibold text-gray-900">{inConsultationCount}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Nouveaux arrivés</p>
              <p className="text-2xl font-semibold text-gray-900">{newlyArrivedCount}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-medical-primary/10 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-medical-primary" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Terminées aujourd'hui</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.consultationsFinished}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Actuel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">Patient actuel</p>
                {waitingQueue.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {isLockedInConsultation && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400"
                        title="Verrouillé sur ce patient jusqu'à la fin de la consultation"
                      >
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                    <div className="relative">
                      <select
                        value={selectedCurrentPatientId || ''}
                        onChange={(e) => handleSelectCurrentPatient(e.target.value || null)}
                        disabled={isLockedInConsultation}
                        title={isLockedInConsultation ? "Verrouillé pendant la consultation en cours" : undefined}
                        className={`appearance-none text-xs border rounded-lg pl-2.5 pr-7 py-1.5 shadow-sm focus:ring-2 focus:ring-medical-primary focus:border-transparent transition-colors min-w-[180px] ${
                          isLockedInConsultation
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <option value="">🤖 Auto (par défaut)</option>
                        {waitingQueue
                          .filter(p => ['waiting', 'present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status))
                          .sort((a, b) => {
                            // Trier par statut puis par nom
                            const statusOrder = { 'in_consultation': 0, 'en_route': 1, 'medecin_pret': 2, 'authorized': 3, 'present': 4, 'arrive': 5 };
                            const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                            if (statusDiff !== 0) return statusDiff;
                            return `${a.patient_prenom} ${a.patient_nom}`.localeCompare(`${b.patient_prenom} ${b.patient_nom}`);
                          })
                          .map((patient) => {
                            const statusIcon = {
                              'present': '🔔',
                              'authorized': '✅',
                              'medecin_pret': '👨‍⚕️',
                              'en_route': '🚶',
                              'in_consultation': '🩺',
                              'arrive': '👤'
                            }[patient.status] || '👤';

                            const statusText = {
                              'present': 'Arrivé',
                              'authorized': 'Autorisé',
                              'medecin_pret': 'Médecin prêt',
                              'en_route': 'Patient appelé',
                              'in_consultation': 'En consultation',
                              'arrive': 'Arrivé'
                            }[patient.status] || 'En attente';

                            return (
                              <option key={patient.id || patient.waiting_queue_id} value={patient.id || patient.waiting_queue_id}>
                                {statusIcon} {patient.patient_prenom} {patient.patient_nom} ({statusText})
                              </option>
                            );
                          })}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {selectedCurrentPatientId && !isLockedInConsultation && (
                      <button
                        onClick={() => handleSelectCurrentPatient(null)}
                        className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors"
                        title="Revenir au mode automatique"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {currentPatient ? (
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex gap-3.5">
                      <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-medical-primary to-medical-secondary text-white flex items-center justify-center text-base font-semibold flex-shrink-0">
                        {(currentPatient.patient_prenom?.[0] || '').toUpperCase()}{(currentPatient.patient_nom?.[0] || '').toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[17px] font-semibold text-gray-900">
                          {currentPatient.patient_prenom} {currentPatient.patient_nom}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="px-2.5 py-1 bg-medical-primary/10 text-medical-primary rounded-full text-xs font-medium">
                            {currentPatient.rdv_motif || currentPatient.motif_consultation || 'Non renseigné'}
                          </span>
                          {(currentPatient.priority === 'urgente' || currentPatient.priority === 'tres_urgente') && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              currentPatient.priority === 'tres_urgente' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {currentPatient.priority === 'tres_urgente' ? 'Très urgent' : 'Urgent'}
                            </span>
                          )}
                        </div>
                        {currentPatient.rdv_date_heure && (
                          <p className="text-xs text-gray-400 mt-2.5">
                            RDV prévu à {new Date(currentPatient.rdv_date_heure).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {currentPatient.temps_attente_minutes > 0 && ` · depuis ${Math.round(currentPatient.temps_attente_minutes)} min`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      currentPatient.status === 'present' ? 'bg-amber-50 text-amber-700' :
                      currentPatient.status === 'arrive' ? 'bg-amber-50 text-amber-700' :
                      currentPatient.status === 'authorized' ? 'bg-blue-50 text-blue-700' :
                      currentPatient.status === 'en_route' ? 'bg-purple-50 text-purple-700' :
                      currentPatient.status === 'in_consultation' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {currentPatient.status === 'present' ? 'Arrivé' :
                       currentPatient.status === 'arrive' ? 'Arrivé' :
                       currentPatient.status === 'authorized' ? 'Demandé' :
                       currentPatient.status === 'en_route' ? 'Patient appelé' :
                       currentPatient.status === 'in_consultation' ? 'En consultation' :
                       currentPatient.status === 'waiting' ? 'En attente' :
                       currentPatient.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5 mt-5">
                    {/* Bouton Recevoir ce patient - pour statuts waiting/present/arrive/authorized/en_route */}
                    {(currentPatient.status === 'waiting' || currentPatient.status === 'present' || currentPatient.status === 'arrive' || currentPatient.status === 'authorized' || currentPatient.status === 'en_route') && (
                      <button
                        onClick={() => handlePatientAction(currentPatient.id, 'receive')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-medical-primary text-white text-sm font-medium rounded-xl hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Recevoir
                      </button>
                    )}

                    {currentPatient.patient_id && (
                      <button
                        onClick={() => navigate(`/rendez-vous/fiche-patient?id=${currentPatient.patient_id}`)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Dossier
                      </button>
                    )}

                    {/* Boutons pour patient en consultation */}
                    {currentPatient.status === 'in_consultation' && (
                      <div className="flex gap-2.5">
                        <button
                          onClick={async () => {
                            // Redirection directe vers la consultation en cours sans passer par ConsultationWorkflowPage
                            try {
                              const waitingQueueId = currentPatient.id;
                              
                              // Récupérer l'item waiting_queue
                              const { data: wq, error: wqErr } = await supabase
                                .from('waiting_queue')
                                .select('patient_id, medecin_id, priority')
                                .eq('id', waitingQueueId)
                                .single();
                              
                              if (wqErr) throw wqErr;
                              
                              // Chercher une consultation existante ou en créer une nouvelle
                              if (wq?.patient_id && wq?.medecin_id) {
                                let consultationId = null;
                                
                                // Chercher une consultation en cours
                                const startOfDay = new Date();
                                startOfDay.setHours(0,0,0,0);
                                const { data: existing, error: findErr } = await supabase
                                  .from('consultations')
                                  .select('id')
                                  .eq('patient_id', wq.patient_id)
                                  .eq('medecin_id', wq.medecin_id)
                                  .gte('date_consultation', startOfDay.toISOString())
                                  .in('statut', ['en_cours','en_attente'])
                                  .order('date_consultation', { ascending: false })
                                  .limit(1);
                                
                                if (findErr) throw findErr;
                                consultationId = existing && existing.length > 0 ? existing[0].id : null;
                                
                                // Créer une consultation si elle n'existe pas
                                if (!consultationId) {
                                  const { data: created, error: createErr } = await supabase
                                    .from('consultations')
                                    .insert({
                                      patient_id: wq.patient_id,
                                      medecin_id: wq.medecin_id,
                                      date_consultation: new Date().toISOString(),
                                      statut: 'en_cours',
                                      niveau_urgence: currentPatient?.priority || wq.priority || 'normale'
                                    })
                                    .select('id')
                                    .single();
                                  
                                  if (createErr) throw createErr;
                                  consultationId = created.id;
                                }
                                
                                // Redirection directe vers la page de consultation
                                const qs = `?from=workflow&waiting_queue_id=${waitingQueueId}`;
                                window.location.hash = `#/consultation/${consultationId}${qs}`;
                              }
                            } catch (e) {
                              console.error('Erreur lors de la redirection vers la consultation:', e);
                              showError('Erreur lors de la redirection vers la consultation: ' + e.message);
                            }
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-medical-primary text-white text-sm font-medium rounded-xl hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          Commencer consultation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun patient en attente</p>
                </div>
              )}
            </div>
          </div>

          {/* Salle d'attente */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">Salle d'attente · {waitingQueue.length}</p>
              </div>
              <div className="p-3.5 flex flex-col gap-2 max-h-96 overflow-y-auto">
                {waitingQueue.length > 0 ? (
                  waitingQueue.map((patient, index) => {
                    const isUrgentPatient = patient.priority === 'urgente' || patient.priority === 'tres_urgente';
                    const badge = getQueueStatusBadge(patient.status);
                    const isCurrent = isCurrentPatient(patient);
                    const isSelectable = !isCurrent && !isLockedInConsultation;
                    return (
                      <div
                        key={patient.id}
                        onClick={() => isSelectable && handleFocusPatient(patient.waiting_queue_id || patient.id)}
                        title={isLockedInConsultation && !isCurrent ? "Verrouillé pendant la consultation en cours" : undefined}
                        className={`p-3 rounded-2xl border transition-colors duration-150 ${
                          isCurrent
                            ? 'border-medical-primary/20 bg-medical-primary/5'
                            : isSelectable
                              ? 'border-gray-100 cursor-pointer hover:border-gray-200 hover:bg-gray-50'
                              : 'border-gray-100 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-[13.5px] truncate">
                            {patient.patient_prenom} {patient.patient_nom}
                          </p>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-gray-400 mt-1">Position {index + 1}</p>
                        {(isCurrent || isUrgentPatient) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-medical-primary/10 text-medical-primary rounded-full text-[11px] font-semibold">
                                ACTUEL
                              </span>
                            )}
                            {isUrgentPatient && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                patient.priority === 'tres_urgente' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                <AlertTriangle className="w-3 h-3" />
                                {patient.priority === 'tres_urgente' ? 'Très urgent' : 'Urgent'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">File d'attente vide</p>
                  </div>
                )}
              </div>
            </div>

            {/* RDV du jour */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mt-5">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">RDV du jour · {todayAppointments.length}</p>
                <button
                  type="button"
                  onClick={() => navigate('/my-calendar')}
                  className="text-xs font-medium text-medical-primary hover:text-medical-primary-dark whitespace-nowrap"
                >
                  Voir mon calendrier
                </button>
              </div>
              <div className="p-3.5 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {todayAppointments.length > 0 ? (
                  todayAppointments.map((appointment) => {
                    const badge = getAppointmentStatusBadge(appointment);
                    const isUrgentAppt = appointment.priorite === 'urgente' || appointment.priorite === 'tres_urgente';
                    return (
                      <div key={appointment.id} className={`p-3 rounded-2xl border text-sm ${isUrgentAppt ? 'border-red-100 bg-red-50/50' : 'border-gray-100'}`}>
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                            {appointment.patient?.prenom} {appointment.patient?.nom}
                            {isUrgentAppt && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                                appointment.priorite === 'tres_urgente' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {appointment.priorite === 'tres_urgente' ? 'Très urgent' : 'Urgent'}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(appointment.date_heure).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{appointment.motif}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4">
                    <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">Aucun RDV aujourd'hui</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de création de rendez-vous — composant réutilisable partagé avec le
            reste de l'app (voir components/rendez-vous/NewAppointmentModal.jsx). */}
        <NewAppointmentModal
          isOpen={showCreateRdvModal}
          onClose={() => setShowCreateRdvModal(false)}
          initialDoctorId={userProfile?.id}
          onSaved={fetchDashboardData}
        />
      </div>
    </div>
  );
};

export default DoctorDashboard;
