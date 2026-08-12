import React, { useState, useEffect, useRef } from 'react';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import CreateRdvModal from './CreateRdvModal';
import {
  computeQueueStats,
  isPresentInQueueStatus,
} from '../../utils/waitingQueueStatus';
import {
  confirmSkippedWorkflowSteps,
  validateQueueTransition,
} from '../../utils/workflowGuards';
import { 
  Users, 
  Clock, 
  Calendar, 
  Bell, 
  User, 
  CheckCircle, 
  Phone, 
  UserCheck,
  Stethoscope,
  AlertTriangle,
  Activity,
  Shield,
  Plus,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';
import CalendarView from '../Calendar';
const DoctorDashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [currentFromRaw, setCurrentFromRaw] = useState(null);
  const [selectedCurrentPatientId, setSelectedCurrentPatientId] = useState(null); // Nouveau: patient actuel sélectionné manuellement
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [finishedConsultations, setFinishedConsultations] = useState([]);
  const [canceledAppointments, setCanceledAppointments] = useState([]);
  const [stats, setStats] = useState({
    totalWaiting: 0,
    inConsultation: 0,
    newPatients: 0,
    consultationsFinished: 0
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRdvModal, setShowCreateRdvModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const previousNotificationIdsRef = useRef(new Set());
  const [patientDocumentsStatus, setPatientDocumentsStatus] = useState({}); // { patientId: 'new' | 'old' | null }
  
    useEffect(() => {
      if (userProfile?.id) {
        fetchDashboardData();
        
        // Subscription temps réel pour waiting_queue
        const channel = supabase.channel('doctor_dashboard')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'waiting_queue',
            filter: `medecin_id=eq.${userProfile.id}`
          }, () => {
            fetchDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'notifications_medecin_secretaire',
            filter: `medecin_id=eq.${userProfile.id}`
          }, () => {
            fetchNotifications();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'documents_patients'
          }, async () => {
            // Rafraîchir le statut des documents quand un document est créé/modifié
            // Récupérer la file d'attente actuelle pour mettre à jour le statut
            const { data: currentQueue } = await supabase
              .from('waiting_queue')
              .select(`
                id,
                status,
                patient_id,
                medecin_id,
                appointment_id,
                motif_consultation,
                priority,
                arrived_at,
                updated_at,
                created_at,
                order_position,
                patient:patients(id, nom, prenom, telephone)
              `)
              .eq('medecin_id', userProfile.id)
              .in('status', ['waiting', 'present', 'arrive', 'in_consultation'])
              .order('created_at', { ascending: true });
            
            if (currentQueue && currentQueue.length > 0) {
              // Transformer les données comme dans fetchDashboardData
              const transformedQueue = currentQueue.map((item) => ({
                ...item,
                patient_id: item.patient_id || item.patient?.id
              }));
              await fetchPatientDocumentsStatus(transformedQueue);
            }
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

      // File d'attente simplifiée - utiliser directement waiting_queue avec filtre de date
      // Tri par date de création (ordre des RV créés) et non par order_position
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: queueData, error: queueError } = await supabase
        .from('waiting_queue')
        .select(`
          id,
          status,
          patient_id,
          medecin_id,
          appointment_id,
          motif_consultation,
          priority,
          arrived_at,
          updated_at,
          created_at,
          order_position,
          patient:patients(id, nom, prenom, telephone),
          appointments(date_heure)
        `)
        .eq('medecin_id', userProfile.id)
        .in('status', ['waiting', 'present', 'arrive', 'in_consultation'])
        .gte('appointments.date_heure', today.toISOString())
        .lt('appointments.date_heure', tomorrow.toISOString())
        .order('created_at', { ascending: true });

      // RDV du jour - récupérer d'abord pour enrichir la file d'attente
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          date_heure,
          motif,
          type_rdv,
          statut,
          patient_id,
          patient:patients(id, nom, prenom, telephone)
        `)
        .eq('medecin_id', userProfile.id)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure');

      // Si la queue a des appointment_ids, récupérer aussi les appointments liés (même hors plage)
      const appointmentIds = (queueData || [])
        .filter(item => item.appointment_id)
        .map(item => item.appointment_id);
      
      let linkedAppointments = [];
      if (appointmentIds.length > 0) {
        const { data: linkedData } = await supabase
          .from('appointments')
          .select(`
            id,
            date_heure,
            motif,
            type_rdv,
            statut,
            patient_id
          `)
          .in('id', appointmentIds);
        linkedAppointments = linkedData || [];
      }

      if (appointmentsError) {
        console.error('Erreur récupération rendez-vous:', appointmentsError);
        setTodayAppointments([]);
      } else {
        setTodayAppointments(appointmentsData || []);
      }

      if (queueError) {
        console.error('Erreur récupération file d\'attente:', queueError);
        setWaitingQueue([]);
      } else {
        // Transformer les données et enrichir avec l'heure du RDV
        const transformedQueue = (queueData || []).map((item, index) => {
          // Trouver le RDV correspondant - PRIORITÉ à appointment_id si disponible
          let matchingAppointment = null;
          if (item.appointment_id) {
            // D'abord chercher dans linkedAppointments (appointments liés via appointment_id)
            matchingAppointment = linkedAppointments.find(
              appt => appt.id === item.appointment_id
            );
            // Sinon dans les RDV d'aujourd'hui
            if (!matchingAppointment) {
              matchingAppointment = (appointmentsData || []).find(
                appt => appt.id === item.appointment_id
              );
            }
          } else {
            // Sinon on cherche par patient_id (fallback)
            matchingAppointment = (appointmentsData || []).find(
              appt => appt.patient_id === item.patient_id
            );
          }
          
          return {
            id: item.id,
            waiting_queue_id: item.id,
            status: item.status,
            patient_prenom: item.patient?.prenom || 'Inconnu',
            patient_nom: item.patient?.nom || 'Patient',
            motif_consultation: item.motif_consultation || matchingAppointment?.motif || '',
            rdv_motif: matchingAppointment?.motif || '',
            rdv_type: matchingAppointment?.type_rdv || '',
            priority: item.priority || 'normale',
            rdv_date_heure: matchingAppointment?.date_heure || null,
            temps_attente_minutes: item.arrived_at ? Math.max(0, Math.floor((Date.now() - new Date(item.arrived_at).getTime())/60000)) : 0,
            notifications_non_lues: 0,
            original_order: index,
            created_at: item.created_at,
            patient_id: item.patient_id
          };
        });
        
        // Trier par heure de rendez-vous (Option 2)
        transformedQueue.sort((a, b) => {
          // 1. D'abord par statut (in_consultation en premier)
          const statusOrder = { 
            'in_consultation': 0, 
            'arrive': 1, 
            'present': 2, 
            'waiting': 3 
          };
          const statusCompare = (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
          if (statusCompare !== 0) return statusCompare;
          
          // 2. Ensuite par heure de RDV (les RDV plus tôt passent en premier)
          if (a.rdv_date_heure && b.rdv_date_heure) {
            return new Date(a.rdv_date_heure).getTime() - new Date(b.rdv_date_heure).getTime();
          }
          // Si seulement a a un RDV, a vient en premier
          if (a.rdv_date_heure && !b.rdv_date_heure) return -1;
          // Si seulement b a un RDV, b vient en premier
          if (!a.rdv_date_heure && b.rdv_date_heure) return 1;
          
          // 3. Si aucun n'a de RDV, trier par ordre d'arrivée
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        setWaitingQueue(transformedQueue);
      }

      // Consultations terminées aujourd'hui (via waiting_queue)
      const { data: finishedWq, error: finishedErr } = await supabase
        .from('waiting_queue')
        .select(`
          id,
          status,
          updated_at,
          patient:patients(prenom, nom)
        `)
        .eq('medecin_id', userProfile.id)
        .eq('status', 'termine')
        .gte('updated_at', today.toISOString())
        .lt('updated_at', tomorrow.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (finishedErr) {
        console.error('Erreur récupération consultations terminées:', finishedErr);
        setFinishedConsultations([]);
      } else {
        setFinishedConsultations(finishedWq || []);
      }

      // Rendez-vous annulés aujourd'hui (statut 'reporte')
      const { data: canceledWq, error: canceledErr } = await supabase
        .from('waiting_queue')
        .select(`
          id,
          status,
          updated_at,
          patient:patients(prenom, nom)
        `)
        .eq('medecin_id', userProfile.id)
        .eq('status', 'reporte')
        .gte('updated_at', today.toISOString())
        .lt('updated_at', tomorrow.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (canceledErr) {
        console.error('Erreur récupération consultations annulées:', canceledErr);
        setCanceledAppointments([]);
      } else {
        setCanceledAppointments(canceledWq || []);
      }

      // Statistiques basées sur les données transformées
      const transformedQueueForStats = queueData || [];
      const computed = computeQueueStats(transformedQueueForStats);
      const queueStats = {
        totalWaiting: computed.onBench,
        inConsultation: computed.inConsultation,
        newPatients: transformedQueueForStats.filter((q) =>
          isPresentInQueueStatus(q.status),
        ).length,
        consultationsFinished: (finishedWq || []).length || 0,
      };
      setStats(queueStats);

      // Notifications
      await fetchNotifications();
      
      // Vérifier les documents pour chaque patient
      await fetchPatientDocumentsStatus(transformedQueueForStats);
    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDocumentsStatus = async (queueData) => {
    try {
      const patientIds = queueData
        .map(item => item.patient_id || item.patient?.id)
        .filter(Boolean);
      
      if (patientIds.length === 0) {
        setPatientDocumentsStatus({});
        return;
      }

      // Obtenir la date d'aujourd'hui à minuit en heure locale
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // Récupérer les documents pour tous les patients
      const { data: documents, error } = await supabase
        .from('documents_patients')
        .select('patient_id, created_at')
        .in('patient_id', patientIds);

      if (error) {
        console.error('Erreur récupération documents:', error);
        return;
      }

      // Créer un objet avec le statut des documents pour chaque patient
      const statusMap = {};
      patientIds.forEach(patientId => {
        const patientDocs = (documents || []).filter(doc => doc.patient_id === patientId);
        if (patientDocs.length === 0) {
          statusMap[patientId] = null; // Pas de documents
        } else {
          // Vérifier s'il y a des documents créés aujourd'hui
          const hasNewToday = patientDocs.some(doc => {
            if (!doc.created_at) return false;
            const docDate = new Date(doc.created_at);
            // Comparer si le document a été créé aujourd'hui (entre minuit et 23h59)
            return docDate >= todayStart && docDate <= todayEnd;
          });
          statusMap[patientId] = hasNewToday ? 'new' : 'old';
        }
      });

      setPatientDocumentsStatus(statusMap);
      console.log('📄 Statut des documents mis à jour:', statusMap);
    } catch (error) {
      console.error('Erreur lors de la vérification des documents:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications_medecin_secretaire')
        .select('*')
        .eq('medecin_id', userProfile.id)
        .eq('lu', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (notificationsError) throw notificationsError;
      
      const currentNotificationIds = new Set((notificationsData || []).map(n => n.id));
      
      // Détecter les nouvelles notifications
      if (previousNotificationIdsRef.current.size > 0) {
        const newNotifications = (notificationsData || []).filter(
          n => !previousNotificationIdsRef.current.has(n.id)
        );
        
        // Afficher un toast pour chaque nouvelle notification
        newNotifications.forEach(notification => {
          console.log('🆕 [DoctorDashboard] Nouvelle notification reçue:', notification);
          
          // Extraire le nom du patient depuis le message ou les métadonnées
          let patientName = 'un patient';
          try {
            const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
            if (metadata.patientName) {
              patientName = metadata.patientName;
            } else if (notification.message) {
              // Le message contient généralement le nom du patient au début
              // Exemples: "Jean Dupont se dirige vers votre bureau" ou "Jean Dupont est arrivé"
              const match = notification.message.match(/^([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+ [A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)/);
              if (match) {
                patientName = match[1];
              } else {
                // Fallback: utiliser le message complet
                patientName = notification.message;
              }
            }
          } catch (e) {
            console.warn('Erreur parsing metadata:', e);
            // Fallback: utiliser le message complet
            if (notification.message) {
              patientName = notification.message;
            }
          }
          
          // Afficher un toast selon le type de notification
          if (notification.type_notification === 'patient_on_way') {
            unifiedNotificationService.medicalWorkflow(
              'patient_en_route',
              patientName,
              'Secrétaire'
            );
          } else if (notification.type_notification === 'patient_arrived') {
            unifiedNotificationService.info(`🏥 ${patientName} est arrivé en salle d'attente`);
          } else if (notification.type_notification === 'urgency') {
            unifiedNotificationService.error(`🚨 URGENT: ${patientName}`);
          } else {
            // Toast générique pour les autres types de notifications
            unifiedNotificationService.info(notification.message || 'Nouvelle notification');
          }
        });
      }
      
      // Mettre à jour la référence des IDs de notifications
      previousNotificationIdsRef.current = currentNotificationIds;
      setNotifications(notificationsData || []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };

  const handlePatientAction = async (patientId, action) => {
    try {
      const findPatient = (queueId) =>
        waitingQueue.find((p) => p.id === queueId || p.waiting_queue_id === queueId);
      const patient = findPatient(patientId);
      const patientName = patient ? `${patient.patient_prenom} ${patient.patient_nom}` : 'Patient';
      const confirmTransition = (queueId, toStatus, actionLabel) => {
        const currentPatient = findPatient(queueId);
        if (!currentPatient) return true;
        const transition = validateQueueTransition(currentPatient.status, toStatus);
        if (!transition.needsConfirmation) return true;
        return confirmSkippedWorkflowSteps(transition.skippedSteps, actionLabel);
      };

      switch (action) {
        case 'receive': {
          // Recevoir directement le patient en consultation
          console.log('Action receive - patientId:', patientId, 'userProfile.id:', userProfile.id);
          
          if (!userProfile?.id) {
            throw new Error('ID du médecin manquant');
          }

          // Vérifier que le patient existe
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

          // PAS de validation workflow - la secrétaire a déjà confirmé l'introduction
          // Le médecin peut recevoir directement le patient sans nouvelle autorisation

          // Mettre directement le statut à 'in_consultation' sans passer par 'authorized'
          const { error: updateError } = await supabase
            .from('waiting_queue')
            .update({ 
              status: 'in_consultation',
              consultation_started_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', patientId)
            .eq('medecin_id', userProfile.id);

          if (updateError) {
            console.error('Erreur mise à jour statut consultation:', updateError);
            throw new Error(`Erreur lors du démarrage de la consultation: ${updateError.message}`);
          }

          // Fixer ce patient comme patient actuel
          setSelectedCurrentPatientId(patientId);
          localStorage.setItem(`doctor_${userProfile?.id}_current_patient`, patientId);

          unifiedNotificationService.success('✅ Consultation démarrée');
          break;
        }
        case 'consultation': {
          if (!confirmTransition(patientId, 'in_consultation', 'démarrer la consultation')) {
            return;
          }

          // Démarrer la consultation si le patient est appelé
          try {
            const target = waitingQueue.find(p => p.id === patientId || p.waiting_queue_id === patientId);
            if (target && target.status === 'en_route') {
              const { error: startErr } = await supabase
                .from('waiting_queue')
                .update({ 
                  status: 'in_consultation',
                  updated_at: new Date().toISOString()
                })
                .eq('id', patientId)
                .eq('medecin_id', userProfile.id);
              if (startErr) throw startErr;
            }
          } catch (e) {
            console.warn('Impossible de démarrer automatiquement:', e?.message || e);
          }
          
          // Trouver ou créer une consultation et rediriger directement
          try {
            const { data: wq, error: wqErr } = await supabase
              .from('waiting_queue')
              .select('patient_id, medecin_id, consultation_id, appointment_id, motif_consultation')
              .eq('id', patientId)
              .single();
            
            if (wqErr) throw wqErr;
            
            if (wq?.patient_id && wq?.medecin_id) {
              let consultationId = wq.consultation_id;
              
              if (!consultationId) {
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
                consultationId = existingConsultation?.id || null;

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
              }
              
              if (!consultationId) {
                const { data: created, error: createErr } = await supabase
                  .from('consultations')
                  .insert({
                    patient_id: wq.patient_id,
                    medecin_id: wq.medecin_id,
                    date_consultation: new Date().toISOString(),
                    appointment_id: wq.appointment_id || null,
                    motif_consultation: wq.motif_consultation || null,
                    motif: wq.motif_consultation || null,
                    statut: 'en_cours'
                  })
                  .select('id')
                  .single();
                
                if (createErr) throw createErr;
                consultationId = created.id;
              }
              
              const qs = `?from=workflow&waiting_queue_id=${patientId}`;
              navigate(`/consultation/${consultationId}${qs}`);
            }
          } catch (e) {
            console.error('Erreur lors de la redirection vers la consultation:', e);
            unifiedNotificationService.error('Erreur lors de la redirection vers la consultation');
          }
          break;
        }
        case 'start': {
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
          try {
            const { data: wq, error: wqErr } = await supabase
              .from('waiting_queue')
              .select('patient_id, medecin_id, consultation_id, appointment_id, motif_consultation')
              .eq('id', patientId)
              .single();
            
            if (wqErr) throw wqErr;
            
            if (wq?.patient_id && wq?.medecin_id) {
              let consultationId = wq.consultation_id;
              
              if (!consultationId) {
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
                consultationId = existingConsultation?.id || null;

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
              }
              
              if (!consultationId) {
                const { data: created, error: createErr } = await supabase
                  .from('consultations')
                  .insert({
                    patient_id: wq.patient_id,
                    medecin_id: wq.medecin_id,
                    date_consultation: new Date().toISOString(),
                    appointment_id: wq.appointment_id || null,
                    motif_consultation: wq.motif_consultation || null,
                    motif: wq.motif_consultation || null,
                    statut: 'en_cours'
                  })
                  .select('id')
                  .single();
                
                if (createErr) throw createErr;
                consultationId = created.id;
              }
              
              const qs = `?from=workflow&waiting_queue_id=${patientId}`;
              navigate(`/consultation/${consultationId}${qs}`);
              return; // Ne pas appeler fetchDashboardData() car on redirige
            }
          } catch (e) {
            console.error('Erreur lors de la redirection vers la consultation:', e);
            unifiedNotificationService.error('Erreur lors de la redirection vers la consultation');
          }
          break;
        }
        case 'finish': {
          if (!confirmTransition(patientId, 'termine', 'terminer la consultation')) {
            return;
          }

          console.log('🔄 [DoctorDashboard] Appel RPC medecin_termine_consultation:', {
            p_waiting_queue_id: patientId,
            p_medecin_id: userProfile.id
          });

          // Utiliser la fonction SQL pour terminer la consultation
          const { data: result, error: finishError } = await supabase
            .rpc('medecin_termine_consultation', {
              p_waiting_queue_id: patientId,
              p_medecin_id: userProfile.id
            });

          if (finishError) {
            console.error('❌ [DoctorDashboard] Erreur fonction SQL:', finishError);
            throw new Error(`Erreur lors de la fin de consultation: ${finishError.message}`);
          }

          console.log('✅ [DoctorDashboard] Résultat RPC:', result);

          if (!result.success) {
            console.error('❌ [DoctorDashboard] RPC retourné success=false:', result);
            throw new Error(result.error);
          }

          unifiedNotificationService.success(`✅ ${result.message}. La secrétaire a été notifiée.`);
          break;
        }
        case 'cancel': {
          // Annuler la consultation côté file d'attente (remet dans annulés du jour)
          const currentPatient = waitingQueue.find(p => p.id === patientId);
          if (currentPatient) {
            const transition = validateQueueTransition(currentPatient.status, 'reporte');
            if (transition.needsConfirmation && !confirmSkippedWorkflowSteps(transition.skippedSteps, 'annuler la consultation')) {
              return;
            }
          }

          const { error: cancelErr } = await supabase
            .from('waiting_queue')
            .update({ status: 'reporte', updated_at: new Date().toISOString() })
            .eq('id', patientId)
            .eq('medecin_id', userProfile.id);
          if (cancelErr) throw cancelErr;
          unifiedNotificationService.error(`Consultation annulée pour ${patientName}`);
          break;
        }
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
        hint: error?.hint
      });
      
      const errorMessage = error?.message || error?.error_description || 'Erreur inconnue';
      unifiedNotificationService.error(`Erreur: ${errorMessage}`);
    }
  };
  
  // Logique de sélection du patient actuel améliorée
  const currentPatient = (() => {
    // Si un patient est sélectionné manuellement, le prioriser
    if (selectedCurrentPatientId) {
      const manuallySelected = waitingQueue.find(p => 
        (p.id === selectedCurrentPatientId || p.waiting_queue_id === selectedCurrentPatientId) &&
        ['arrive', 'in_consultation', 'present', 'waiting', 'authorized', 'en_route'].includes(p.status)
      );
      if (manuallySelected) {
        return manuallySelected;
      }
      // Si le patient sélectionné n'existe plus ou n'a plus un statut valide, ne pas changer automatiquement
      return null;
    }
    
    // Sinon, utiliser la logique automatique (patient en consultation en priorité)
    const inConsultation = waitingQueue.find(p => p.status === 'in_consultation');
    if (inConsultation) {
      return inConsultation;
    }
    
    // Puis patient arrivé/en_route/authorized (un seul à la fois)
    const available = waitingQueue.find(p => ['arrive', 'present', 'authorized', 'en_route'].includes(p.status));
    return available;
  })();
  
  // Fonction pour sélectionner manuellement un patient actuel
  const handleSelectCurrentPatient = async (patientId) => {
    console.log('Sélection manuelle du patient actuel:', patientId);
    
    if (patientId) {
      // Vérifier que le patient existe
      const patient = waitingQueue.find(p => 
        (p.id === patientId || p.waiting_queue_id === patientId)
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
      
      setSelectedCurrentPatientId(patientId);
      localStorage.setItem(`doctor_${userProfile?.id}_current_patient`, patientId);
      const patientName = `${patient.patient_prenom} ${patient.patient_nom}`;
      unifiedNotificationService.success(`${patientName} défini comme patient actuel`);
    } else {
      setSelectedCurrentPatientId(null);
      localStorage.removeItem(`doctor_${userProfile?.id}_current_patient`);
      unifiedNotificationService.info('Mode automatique activé');
    }
  };
  
  // Restaurer la sélection depuis le localStorage au chargement
  useEffect(() => {
    if (userProfile?.id && waitingQueue.length > 0) {
      const savedPatientId = localStorage.getItem(`doctor_${userProfile.id}_current_patient`);
      if (savedPatientId && !selectedCurrentPatientId) {
        // Vérifier que le patient existe toujours dans la file d'attente
        const patientExists = waitingQueue.find(p => 
          (p.id === savedPatientId || p.waiting_queue_id === savedPatientId) &&
          ['arrive', 'in_consultation', 'present', 'waiting'].includes(p.status)
        );
        if (patientExists) {
          setSelectedCurrentPatientId(savedPatientId);
          console.log('🔄 Sélection patient restaurée depuis localStorage:', savedPatientId);
        } else {
          // Nettoyer si le patient n'existe plus
          localStorage.removeItem(`doctor_${userProfile.id}_current_patient`);
        }
      }
    }
  }, [userProfile?.id, waitingQueue.length, selectedCurrentPatientId]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast de succès */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-lg p-4 flex items-center space-x-3 max-w-md">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="ml-auto text-green-500 hover:text-green-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* En-tête */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tableau de Bord - Dr. {userProfile?.prenom} {userProfile?.nom}
            </h1>
            <p className="text-gray-600">{userProfile?.specialite}</p>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} - {new Date().toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateRdvModal(true)}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau rendez-vous
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-900">Notifications ({notifications.length})</h3>
              </div>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} className="bg-white p-3 rounded border border-blue-100">
                    <p className="text-sm text-gray-800">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.created_at).toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ))}
                {notifications.length > 3 && (
                  <p className="text-xs text-blue-600 text-center">
                    +{notifications.length - 3} autres notifications
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En attente</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWaiting}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Stethoscope className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En consultation</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inConsultation}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-full">
                <Bell className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Nouveaux</p>
                <p className="text-2xl font-bold text-gray-900">{stats.newPatients}</p>
                {stats.newPatients > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                    Alertes
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Terminées</p>
                <p className="text-2xl font-bold text-gray-900">{stats.consultationsFinished}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Patient Actuel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <User className="w-6 h-6 mr-2" />
                    Patient Actuel
                  </h2>
                  {waitingQueue.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Sélection:</span>
                      </div>
                      <select
                        value={selectedCurrentPatientId || ''}
                        onChange={(e) => handleSelectCurrentPatient(e.target.value || null)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-w-[400px] max-w-[600px]"
                      >
                        <option value="">🤖 Auto (par défaut)</option>
                        {waitingQueue
                          .filter(p => ['arrive', 'present', 'waiting', 'in_consultation', 'appele'].includes(p.status))
                          .sort((a, b) => {
                            // 1. Trier par priorité d'abord (très urgent > urgent > normal)
                            const priorityOrder = { 'tres_urgente': 0, 'urgente': 1, 'normale': 2 };
                            const aPriority = a.rdv_priorite || a.priority || 'normale';
                            const bPriority = b.rdv_priorite || b.priority || 'normale';
                            const priorityDiff = (priorityOrder[aPriority] || 99) - (priorityOrder[bPriority] || 99);
                            if (priorityDiff !== 0) return priorityDiff;
                            
                            // 2. Puis par statut (en consultation > arrivé > présent > en attente)
                            const statusOrder = { 'in_consultation': 0, 'arrive': 1, 'present': 2, 'waiting': 3 };
                            const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                            if (statusDiff !== 0) return statusDiff;
                            
                            // 3. Enfin par heure de RDV (ou created_at si pas de RDV)
                            if (a.rdv_date_heure && b.rdv_date_heure) {
                              return new Date(a.rdv_date_heure).getTime() - new Date(b.rdv_date_heure).getTime();
                            }
                            if (a.rdv_date_heure && !b.rdv_date_heure) return -1;
                            if (!a.rdv_date_heure && b.rdv_date_heure) return 1;
                            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                          })
                          .map((patient) => {
                            const statusIcon = {
                              'arrive': '🔔',
                              'in_consultation': '🩺', 
                              'present': '👤',
                              'waiting': '⏳'
                            }[patient.status] || '👤';
                            
                            const statusText = {
                              'arrive': 'Arrivé',
                              'in_consultation': 'En consultation', 
                              'present': 'Présent',
                              'waiting': 'En attente'
                            }[patient.status] || 'En attente';
                            
                            // Utiliser rdv_motif en priorité, sinon motif_consultation
                            const motif = patient.rdv_motif || patient.motif_consultation || 'Non renseigné';
                            const motifDisplay = ` | Motif: ${motif}`;
                            
                            // Utiliser rdv_priorite en priorité, sinon priority
                            const patientPriority = patient.rdv_priorite || patient.priority || 'normale';
                            
                            const priorityIcon = {
                              'tres_urgente': '🚨',
                              'urgente': '⚠️',
                              'normale': '✓'
                            }[patientPriority] || '✓';
                            
                            const priorityLabel = {
                              'tres_urgente': 'TRÈS URGENT',
                              'urgente': 'URGENT',
                              'normale': 'Normal'
                            }[patientPriority] || 'Normal';
                            
                            // Log pour déboguer
                            const displayText = `${priorityIcon} ${patient.patient_prenom} ${patient.patient_nom} (${statusText}) | Priorité: ${priorityLabel}${motifDisplay}`;
                            console.log('Option dropdown:', displayText);
                            
                            return (
                              <option key={patient.id || patient.waiting_queue_id} value={patient.id || patient.waiting_queue_id}>
                                {displayText}
                              </option>
                            );
                          })}
                      </select>
                      {selectedCurrentPatientId && (
                        <button
                          onClick={() => handleSelectCurrentPatient(null)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                          title="Revenir au mode automatique"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

{currentPatient ? (
<div className="p-6">
<div className="flex items-center justify-between mb-4">
<div className="flex-1">
<h3 className="text-lg font-medium text-gray-900">
{currentPatient.patient_prenom} {currentPatient.patient_nom}
</h3>

{/* Motif de consultation */}
<div className="flex items-center mt-2">
<span className="text-sm font-medium text-gray-700 mr-2">Motif:</span>
<span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
{currentPatient.rdv_motif || currentPatient.motif_consultation || 'Non renseigné'}
</span>
</div>

{/* Type de rendez-vous */}
{currentPatient.rdv_type && (
<div className="flex items-center mt-2">
<span className="text-sm font-medium text-gray-700 mr-2">Type:</span>
<span className={`text-sm font-medium px-3 py-1 rounded-full ${
  currentPatient.rdv_type === 'consultation' ? 'bg-purple-100 text-purple-800' :
  currentPatient.rdv_type === 'suivi' ? 'bg-cyan-100 text-cyan-800' :
  currentPatient.rdv_type === 'urgence' ? 'bg-red-100 text-red-800' :
  currentPatient.rdv_type === 'preventif' ? 'bg-green-100 text-green-800' :
  'bg-gray-100 text-gray-700'
}`}>
{currentPatient.rdv_type === 'consultation' ? '🏥 Consultation' :
 currentPatient.rdv_type === 'suivi' ? '📋 Suivi' :
 currentPatient.rdv_type === 'urgence' ? '🚑 Urgence' :
 currentPatient.rdv_type === 'preventif' ? '💚 Préventif' :
 currentPatient.rdv_type}
</span>
</div>
)}

{/* Priorité */}
<div className="flex items-center mt-2">
<span className="text-sm font-medium text-gray-700 mr-2">Priorité:</span>
<span className={`text-sm font-medium px-3 py-1 rounded-full ${
  (currentPatient.rdv_priorite || currentPatient.priority) === 'tres_urgente' ? 'bg-red-100 text-red-800' :
  (currentPatient.rdv_priorite || currentPatient.priority) === 'urgente' ? 'bg-orange-100 text-orange-800' :
  'bg-gray-100 text-gray-700'
}`}>
{(currentPatient.rdv_priorite || currentPatient.priority) === 'tres_urgente' ? '🚨 Très Urgent' :
 (currentPatient.rdv_priorite || currentPatient.priority) === 'urgente' ? '⚠️ Urgent' :
 '✓ Normal'}
</span>
</div>

{currentPatient.rdv_date_heure && (
<p className="text-xs text-gray-400 mt-2">
RDV prévu : {new Date(currentPatient.rdv_date_heure).toLocaleTimeString('fr-FR', { 
hour: '2-digit', 
minute: '2-digit' 
})}
</p>
)}
</div>
<div className="text-right">
{currentPatient.status !== 'en_route' && (
<span className={`px-3 py-1 rounded-full text-sm font-medium ${
currentPatient.status === 'arrive' ? 'bg-orange-100 text-orange-800' :
currentPatient.status === 'in_consultation' ? 'bg-green-100 text-green-800' :
'bg-gray-100 text-gray-800'
}`}>
{currentPatient.status === 'arrive' ? '🔔 Patient arrivé' :
currentPatient.status === 'in_consultation' ? '🩺 En consultation' :
currentPatient.status}
</span>
)}
{currentPatient.temps_attente_minutes > 0 && (
<p className="text-xs text-gray-500 mt-1">
{Math.round(currentPatient.temps_attente_minutes)}min d'attente
</p>
)}
</div>
</div>

<div className="flex space-x-2">
{/* Bouton Recevoir ce patient - pour statuts arrive/en_route/authorized */}
{(currentPatient.status === 'arrive' || currentPatient.status === 'en_route' || currentPatient.status === 'authorized') && (
<button
onClick={() => {
  const patientId = currentPatient.waiting_queue_id || currentPatient.id;
  if (!patientId) {
    unifiedNotificationService.error('ID du patient manquant');
    return;
  }
  handlePatientAction(patientId, 'receive');
}}
className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
>
<Shield className="w-4 h-4 mr-2" />
Recevoir
</button>
)}

{currentPatient.status === 'in_consultation' && (
<>
<button
onClick={async () => {
  try {
    const waitingQueueId = currentPatient.waiting_queue_id || currentPatient.id;
    const { data: wq, error: wqErr } = await supabase
      .from('waiting_queue')
      .select('patient_id, medecin_id, consultation_id, appointment_id, motif_consultation')
      .eq('id', waitingQueueId)
      .single();
    
    if (wqErr) throw wqErr;
    
    if (wq?.patient_id && wq?.medecin_id) {
      let consultationId = wq.consultation_id;
      
      if (!consultationId) {
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
        consultationId = existingConsultation?.id || null;

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
      }
      
      if (!consultationId) {
        const { data: created, error: createErr } = await supabase
          .from('consultations')
          .insert({
            patient_id: wq.patient_id,
            medecin_id: wq.medecin_id,
            date_consultation: new Date().toISOString(),
            appointment_id: wq.appointment_id || null,
            motif_consultation: wq.motif_consultation || null,
            motif: wq.motif_consultation || null,
            statut: 'en_cours'
          })
          .select('id')
          .single();
        
        if (createErr) throw createErr;
        consultationId = created.id;
      }
      
      const qs = `?from=workflow&waiting_queue_id=${waitingQueueId}`;
      navigate(`/consultation/${consultationId}${qs}`);
    }
  } catch (e) {
    console.error('Erreur lors de la redirection vers la consultation:', e);
    unifiedNotificationService.error('Erreur lors de la redirection vers la consultation');
  }
}}
className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
>
<Stethoscope className="w-4 h-4 mr-2" />
Consulter
</button>
<button
onClick={() => handlePatientAction(currentPatient.waiting_queue_id || currentPatient.id, 'finish')}
className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
>
<CheckCircle className="w-4 h-4 mr-2" />
Terminer
</button>
</>
)}

</div>
</div>
) : (
<div className="p-6 text-center">
<User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
<p className="text-gray-500">Aucun patient en attente</p>
</div>
)}
</div>
</div>

{/* Salle d'attente */}
<div className="lg:col-span-1">
<div className="bg-white rounded-lg shadow-md border border-gray-200">
<div className="p-4 border-b border-gray-200">
<h3 className="text-lg font-semibold text-gray-900">Salle d'attente ({waitingQueue.length})</h3>
</div>
<div className="p-4 max-h-96 overflow-y-auto">
{waitingQueue.length > 0 ? (
<div className="space-y-3">
{waitingQueue
.sort((a, b) => {
  // 1. Trier par priorité d'abord (très urgent > urgent > normal)
  const priorityOrder = { 'tres_urgente': 0, 'urgente': 1, 'normale': 2 };
  const aPriority = a.rdv_priorite || a.priority || 'normale';
  const bPriority = b.rdv_priorite || b.priority || 'normale';
  const priorityDiff = (priorityOrder[aPriority] || 99) - (priorityOrder[bPriority] || 99);
  if (priorityDiff !== 0) return priorityDiff;
  
  // 2. Puis par statut (en consultation > arrivé > présent > en attente)
  const statusOrder = { 'in_consultation': 0, 'arrive': 1, 'present': 2, 'waiting': 3 };
  const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  if (statusDiff !== 0) return statusDiff;
  
  // 3. Enfin par heure de RDV (ou created_at si pas de RDV)
  if (a.rdv_date_heure && b.rdv_date_heure) {
    return new Date(a.rdv_date_heure).getTime() - new Date(b.rdv_date_heure).getTime();
  }
  if (a.rdv_date_heure && !b.rdv_date_heure) return -1;
  if (!a.rdv_date_heure && b.rdv_date_heure) return 1;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
})
.map((patient, index) => (
<div key={patient.id} className={`p-3 border rounded-lg ${
(patient.id === currentPatient?.id) ||
(patient.waiting_queue_id && currentPatient?.waiting_queue_id && patient.waiting_queue_id === currentPatient.waiting_queue_id)
? 'border-blue-300 bg-blue-50' : 'border-gray-200'
}`}>
<div className="flex items-center justify-between">
<div className="flex-1">
<p className="font-medium text-gray-900 text-sm">
{patient.patient_prenom} {patient.patient_nom}
{((patient.id === currentPatient?.id) || (patient.waiting_queue_id === currentPatient?.waiting_queue_id)) && (
<span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
ACTUEL
</span>
)}
</p>
<p className="text-xs text-gray-500">
Position: {index + 1}
{patient.rdv_date_heure && (
<span className="ml-2">• RDV: {new Date(patient.rdv_date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
)}
</p>
</div>
<div className="flex flex-col items-end gap-2">
<span className={`px-2 py-1 rounded-full text-xs font-medium ${
patient.status === 'arrive' ? 'bg-orange-100 text-orange-800' :
patient.status === 'in_consultation' ? 'bg-green-100 text-green-800' :
'bg-gray-100 text-gray-800'
}`}>
{patient.status === 'arrive' ? '🔔 Arrivé' :
patient.status === 'in_consultation' ? '🩺 Consultation' :
patient.status}
</span>

<div className="flex gap-1">
{/* Bouton Documents */}
{(() => {
  const patientId = patient.patient_id || patient.patient?.id;
  const docStatus = patientDocumentsStatus[patientId];
  if (docStatus === 'new') {
    return (
      <button
        onClick={() => {
          const patientId = patient.patient_id || patient.patient?.id;
          if (patientId) {
            navigate(`/consultation/${patientId}?tab=documents`);
          }
        }}
        className="flex items-center px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
        title="Nouveaux documents aujourd'hui"
      >
        <FileText className="w-3 h-3 mr-1" />
        Docs
      </button>
    );
  } else if (docStatus === 'old') {
    return (
      <button
        onClick={() => {
          const patientId = patient.patient_id || patient.patient?.id;
          if (patientId) {
            navigate(`/consultation/${patientId}?tab=documents`);
          }
        }}
        className="flex items-center px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
        title="Documents disponibles"
      >
        <FileText className="w-3 h-3 mr-1" />
        Docs
      </button>
    );
  }
  return null; // Pas de documents, pas de bouton
})()}

{/* Bouton pour définir comme patient actuel */}
{!((patient.id === currentPatient?.id) || (patient.waiting_queue_id === currentPatient?.waiting_queue_id)) && (
<button
onClick={() => handleSelectCurrentPatient(patient.waiting_queue_id || patient.id)}
className="flex items-center px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
title="Définir comme patient actuel"
>
Actuel
</button>
)}

{patient.status === 'arrive' && (
<button
onClick={() => handlePatientAction(patient.waiting_queue_id || patient.id, 'receive')}
className="flex items-center px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
>
Recevoir
</button>
)}
</div>

{patient.notifications_non_lues > 0 && (
<span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
{patient.notifications_non_lues} 🔔
</span>
)}
</div>
</div>
</div>
))}
</div>
) : (
<div className="text-center py-8">
<Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
<p className="text-gray-500 text-sm">File d'attente vide</p>
</div>
)}
</div>
</div>

{/* RDV du jour */}
<div className="bg-white rounded-lg shadow-md border border-gray-200 mt-6">
<div className="p-4 border-b border-gray-200">
<h3 className="text-lg font-semibold text-gray-900">RDV du jour ({todayAppointments.length})</h3>
</div>
<div className="p-4 max-h-64 overflow-y-auto">
{todayAppointments.length > 0 ? (
<div className="space-y-2">
{todayAppointments.map((appointment) => (
<div key={appointment.id} className="p-2 border rounded text-sm">
<div className="flex justify-between items-center">
<span className="font-medium">
{appointment.patient?.prenom} {appointment.patient?.nom}
</span>
<span className="text-xs text-gray-500">
{new Date(appointment.date_heure).toLocaleTimeString('fr-FR', { 
hour: '2-digit', 
minute: '2-digit' 
})}
</span>
</div>
<p className="text-xs text-gray-600">{appointment.motif}</p>
</div>
))}
</div>
) : (
<div className="text-center py-4">
<Calendar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
<p className="text-gray-500 text-xs">Aucun RDV aujourd'hui</p>
</div>
)}
</div>
</div>

{/* Calendrier dynamique du médecin */}
<div className="mt-8 bg-white rounded-lg shadow-md border border-gray-200">
<div className="p-4 border-b border-gray-200 flex items-center justify-between">
<h3 className="text-lg font-semibold text-gray-900 flex items-center">
<Calendar className="w-5 h-5 text-blue-600 mr-2" />
Calendrier
</h3>
</div>
<div className="p-2">
{userProfile?.id && (
<CalendarView selectedDoctorFilter={String(userProfile.id)} initialView="timeGridDay" compact={true} />
)}
</div>
</div>

</div>
{/* end grid container */}
</div>
{/* end max-w-7xl */}
</div>
{/* end outer container */}

        {/* Modal de création de rendez-vous */}
        <CreateRdvModal
          isOpen={showCreateRdvModal}
          onClose={() => setShowCreateRdvModal(false)}
          patientId={null}
          medecinId={userProfile?.id}
          onSuccess={(newRdv) => {
            console.log('✅ [DoctorDashboard] RDV créé:', newRdv);
            setSuccessMessage(`Rendez-vous créé avec succès pour le ${new Date(newRdv.date_heure).toLocaleDateString('fr-FR')}`);
            setShowSuccessToast(true);
            setTimeout(() => {
              setShowSuccessToast(false);
              fetchDashboardData(); // Rafraîchir les données
            }, 3000);
          }}
        />
</div>
);
};
export default DoctorDashboard;
