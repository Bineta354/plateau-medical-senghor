import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import CreateRdvModal from './CreateRdvModal';
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
  Plus,
  X,
  Settings,
  FileText
} from 'lucide-react';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [selectedCurrentPatientId, setSelectedCurrentPatientId] = useState(null); // Nouveau: patient actuel sélectionné manuellement
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [stats, setStats] = useState({
    totalWaiting: 0,
    inConsultation: 0,
    newPatients: 0,
    consultationsFinished: 0
  });
  const [loading, setLoading] = useState(true);
  const [showCreateRdvModal, setShowCreateRdvModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

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
        inConsultation: queueData?.filter(q => q.status === 'in_consultation').length || 0,
        newPatients: queueData?.filter(q => q.nouveau_en_attente).length || 0,
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
        const validStatus = ['present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status);
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
    const available = waitingQueue.find(p => ['present', 'authorized', 'medecin_pret', 'en_route', 'arrive'].includes(p.status));
    console.log('Patient disponible (auto):', available);
    return available;
  }, [selectedCurrentPatientId, waitingQueue, userProfile?.id]);
  
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
      const patientName = `${patient.patient_prenom} ${patient.patient_nom}`;
      console.log('Patient trouvé pour sélection:', patient);
      unifiedNotificationService.success(`${patientName} défini comme patient actuel`);
    } else {
      setSelectedCurrentPatientId(null);
      localStorage.removeItem(`doctor_${userProfile?.id}_current_patient`);
      unifiedNotificationService.info('Mode automatique activé');
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

  const isCurrentPatient = (patient) =>
    String(patient?.id) === String(currentPatient?.id) ||
    String(patient?.waiting_queue_id) === String(currentPatient?.waiting_queue_id);
  
  // Restaurer la sélection depuis le localStorage au chargement
  useEffect(() => {
    if (userProfile?.id && waitingQueue.length > 0 && !selectedCurrentPatientId) {
      const savedPatientId = localStorage.getItem(`doctor_${userProfile.id}_current_patient`);
      console.log('Tentative de restauration depuis localStorage:', savedPatientId);
      
      if (savedPatientId) {
        // Vérifier que le patient existe toujours dans la file d'attente
        const patientExists = waitingQueue.find(p => {
          const match = String(p.id) === String(savedPatientId) || String(p.waiting_queue_id) === String(savedPatientId);
          const validStatus = ['present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status);
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
              onClick={() => navigate('/personnalisation')}
              className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary/90 transition-colors shadow-md"
            >
              <FileText className="w-4 h-4 mr-2" />
              Personnalisation
            </button>
            <button
              onClick={() => setShowCreateRdvModal(true)}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau rendez-vous
            </button>
          </div>
        </div>

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
                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-w-[200px]"
                      >
                        <option value="">🤖 Auto (par défaut)</option>
                        {waitingQueue
                          .filter(p => ['present', 'authorized', 'medecin_pret', 'en_route', 'in_consultation', 'arrive'].includes(p.status))
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
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {currentPatient.patient_prenom} {currentPatient.patient_nom}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className="text-xs font-medium text-gray-600 mr-2">Motif:</span>
                        <span className="text-sm text-gray-700 bg-blue-50 px-2 py-1 rounded-full">
                          {currentPatient.rdv_motif || currentPatient.motif_consultation || 'Non renseigné'}
                        </span>
                      </div>
                      {(currentPatient.rdv_type || currentPatient.type_rdv) && (
                        <div className="flex items-center mt-2">
                          <span className="text-xs font-medium text-gray-600 mr-2">Type:</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                            (currentPatient.rdv_type || currentPatient.type_rdv) === 'consultation' ? 'bg-purple-100 text-purple-700' :
                            (currentPatient.rdv_type || currentPatient.type_rdv) === 'suivi' ? 'bg-cyan-100 text-cyan-700' :
                            (currentPatient.rdv_type || currentPatient.type_rdv) === 'urgence' ? 'bg-red-100 text-red-700' :
                            (currentPatient.rdv_type || currentPatient.type_rdv) === 'preventif' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {(currentPatient.rdv_type || currentPatient.type_rdv) === 'consultation' && '🏥 Consultation'}
                            {(currentPatient.rdv_type || currentPatient.type_rdv) === 'suivi' && '📋 Suivi'}
                            {(currentPatient.rdv_type || currentPatient.type_rdv) === 'urgence' && '🚑 Urgence'}
                            {(currentPatient.rdv_type || currentPatient.type_rdv) === 'preventif' && '💚 Préventif'}
                            {['consultation','suivi','urgence','preventif'].includes(currentPatient.rdv_type || currentPatient.type_rdv) ? '' : (currentPatient.rdv_type || currentPatient.type_rdv)}
                          </span>
                        </div>
                      )}
                      {currentPatient.rdv_date_heure && (
                        <p className="text-xs text-gray-400">
                          RDV prévu : {new Date(currentPatient.rdv_date_heure).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        currentPatient.status === 'present' ? 'bg-orange-100 text-orange-800' :
                        currentPatient.status === 'arrive' ? 'bg-orange-100 text-orange-800' :
                        currentPatient.status === 'authorized' ? 'bg-blue-100 text-blue-800' :
                        currentPatient.status === 'en_route' ? 'bg-purple-100 text-purple-800' :
                        currentPatient.status === 'in_consultation' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {currentPatient.status === 'present' ? '🔔 Arrivé' :
                         currentPatient.status === 'arrive' ? '🔔 Arrivé' :
                         currentPatient.status === 'authorized' ? '✅ Demandé' :
                         currentPatient.status === 'en_route' ? '🚶 Patient appelé' :
                         currentPatient.status === 'in_consultation' ? '🩺 En consultation' :
                         currentPatient.status}
                      </span>
                      {currentPatient.temps_attente_minutes > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {Math.round(currentPatient.temps_attente_minutes)}min d'attente
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {/* Bouton Recevoir ce patient - pour statuts present/arrive/authorized/en_route */}
                    {(currentPatient.status === 'present' || currentPatient.status === 'arrive' || currentPatient.status === 'authorized' || currentPatient.status === 'en_route') && (
                      <button
                        onClick={() => handlePatientAction(currentPatient.id, 'receive')}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Recevoir ce patient
                      </button>
                    )}
                    
                    {/* Boutons pour patient en consultation */}
                    {currentPatient.status === 'in_consultation' && (
                      <div className="flex space-x-2">
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
                          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Stethoscope className="w-4 h-4 mr-2" />
                          Commencer consultation
                        </button>
                      </div>
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
                <h3 className="text-lg font-semibold text-gray-900">Salle d'attente ({waitingQueue.filter(p => p.status === 'waiting').length})</h3>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {waitingQueue.filter(p => p.status === 'waiting').length > 0 ? (
                  <div className="space-y-3">
                    {waitingQueue.filter(p => p.status === 'waiting').map((patient, index) => (
                      <div key={patient.id} className={`p-3 border rounded-lg ${
                        isCurrentPatient(patient) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
                              {patient.patient_prenom} {patient.patient_nom}
                              {isCurrentPatient(patient) && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                  ACTUEL
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              Position: {index + 1}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              patient.status === 'waiting' ? 'bg-gray-100 text-gray-800' :
                              patient.status === 'present' ? 'bg-orange-100 text-orange-800' :
                              patient.status === 'arrive' ? 'bg-orange-100 text-orange-800' :
                              patient.status === 'authorized' ? 'bg-green-100 text-green-800' :
                              patient.status === 'in_consultation' ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {patient.status === 'waiting' ? 'Attente' :
                               patient.status === 'present' ? 'Arrivé' :
                               patient.status === 'arrive' ? 'Arrivé' :
                               patient.status === 'authorized' ? 'Autorisé' :
                               patient.status === 'in_consultation' ? 'Consultation' :
                               patient.status}
                            </span>

                            <div className="flex gap-2">
                              {!isCurrentPatient(patient) && (
                                <button
                                  type="button"
                                  onClick={() => handleFocusPatient(patient.waiting_queue_id || patient.id)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                                >
                                  Choisir
                                </button>
                              )}

                              {(patient.status === 'present' || patient.status === 'arrive') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const patientId = patient.waiting_queue_id || patient.id;
                                    handleFocusPatient(patientId);
                                    handlePatientAction(patientId, 'receive');
                                  }}
                                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                                >
                                  Recevoir
                                </button>
                              )}
                            </div>
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
              <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">RDV du jour ({todayAppointments.length})</h3>
                <button
                  type="button"
                  onClick={() => navigate('/my-calendar')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Voir mon calendrier
                </button>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                {todayAppointments.length > 0 ? (
                  <div className="space-y-2">
                    {todayAppointments.map((appointment) => {
                      const badge = getAppointmentStatusBadge(appointment);
                      return (
                        <div key={appointment.id} className="p-2 border rounded text-sm">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-medium truncate">
                              {appointment.patient?.prenom} {appointment.patient?.nom}
                            </span>
                            <span className="flex items-center gap-2 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(appointment.date_heure).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{appointment.motif}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Calendar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">Aucun RDV aujourd'hui</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
    </div>
  );
};

export default DoctorDashboard;
