import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PlusIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  FunnelIcon,
  XCircleIcon,
  ArrowPathIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PatientForm from '../components/common/PatientForm';
import KpiCard from '../components/common/KpiCard';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../utils/permissions';
import completeRealtimeService from '../services/completeRealtimeService';
import { notificationService } from '../services/notificationService';
import { getLibellePraticiens, getTitrePraticien } from '../utils/traductions';
import { formatDoctorDisplay, formatDoctorSpecialties, getDoctorInitials } from '../utils/doctorUtils';
import NotificationPanel from '../components/secretary/NotificationPanel';
import PatientQueueCard from '../components/waitingqueue/PatientQueueCard';
import AppointmentCard from '../components/waitingqueue/AppointmentCard';
import { secretaryService } from '../services/secretaryService';
import { isTerminalQueueStatus } from '../utils/waitingQueueStatus';

const WaitingQueuePage = () => {
  const { currentUser, getUserProfile } = useAuth();
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showDoctorSearch, setShowDoctorSearch] = useState(false);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [patientsPresents, setPatientsPresents] = useState(new Set());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Debounce pour éviter les rechargements trop fréquents
  const [reloadTimeoutId, setReloadTimeoutId] = useState(null);
  
  // Fonction de rechargement avec debounce
  const debouncedReload = () => {
    if (reloadTimeoutId) {
      clearTimeout(reloadTimeoutId);
    }
    
    const newTimeoutId = setTimeout(() => {
      console.log('🔄 [WaitingQueue] Rechargement debouncé des données');
      loadData();
    }, 500); // Attendre 500ms avant de recharger
    
    setReloadTimeoutId(newTimeoutId);
  };

  // Configuration du service realtime complet
  const setupOptimizedRealtime = async () => {
    console.log('🚀 [WaitingQueue] Configuration service realtime complet...');
    setRealtimeStatus('connecting');
    
    try {
      // Initialiser le service realtime complet
      const initialized = await completeRealtimeService.initialize();
      if (!initialized) {
        console.error('❌ [WaitingQueue] Échec initialisation service realtime');
        setRealtimeStatus('error');
        return;
      }

      // Tester la connexion
      const connectionOk = await completeRealtimeService.testConnection();
      if (!connectionOk) {
        console.error('❌ [WaitingQueue] Test connexion échoué');
        setRealtimeStatus('error');
        return;
      }

      // S'abonner seulement aux tables nécessaires pour éviter les conflits
      completeRealtimeService.subscribeToAll({
        waitingQueue: () => {
          console.log('🔄 [WaitingQueue] File d\'attente mise à jour');
          debouncedReload();
        },
        appointments: () => {
          console.log('🔄 [WaitingQueue] Rendez-vous mis à jour');
          debouncedReload();
        }
      });

      // Vérifier le statut de connexion
      const status = completeRealtimeService.getConnectionStatus();
      if (status.isConnected) {
        setRealtimeStatus('connected');
        console.log('✅ [WaitingQueue] Service realtime complet connecté');
        console.log('📊 [WaitingQueue] Canaux actifs:', status.channelNames);
      } else {
        setRealtimeStatus('connecting');
        console.log('🔄 [WaitingQueue] Connexion service realtime en cours...');
      }

    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur configuration service realtime:', error);
      setRealtimeStatus('error');
    }
  };

  // Nettoyage du service realtime complet
  const cleanupOptimizedRealtime = () => {
    console.log('🧹 [WaitingQueue] Nettoyage service realtime complet...');
    
    // Nettoyer le timeout de debounce
    if (reloadTimeoutId) {
      clearTimeout(reloadTimeoutId);
      setReloadTimeoutId(null);
    }
    
    // Nettoyer le service realtime
    completeRealtimeService.cleanup();
    setRealtimeStatus('connecting');
  };

  // Fonction pour forcer la reconnexion
  const forceReconnect = async () => {
    console.log('🔄 [WaitingQueue] Reconnexion forcée...');
    setRealtimeStatus('connecting');
    
    try {
      // Nettoyer d'abord
      cleanupOptimizedRealtime();
      
      // Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconfigurer
      await setupOptimizedRealtime();
      
      console.log('✅ [WaitingQueue] Reconnexion forcée terminée');
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur reconnexion forcée:', error);
      setRealtimeStatus('error');
    }
  };

  // Fonction pour recharger uniquement la file d'attente
  const loadWaitingQueueData = async () => {
    try {
      console.log('🔄 [WaitingQueue] Rechargement file d\'attente...');
      
      // Calculer les bornes de la date d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();
      
      const { data: waitingQueueData, error: waitingError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          medecin:users!inner(id, actif),
          appointments(date_heure, statut_arrivee, heure_arrivee)
        `)
        .gte('appointments.date_heure', todayStart)
        .lt('appointments.date_heure', tomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive')
        .order('created_at', { ascending: false });

      if (waitingError) {
        console.error('❌ [WaitingQueue] Erreur rechargement file d\'attente:', waitingError);
        return;
      }

      // Filtrer pour ne montrer que les entrées avec des médecins actifs
      const filteredWaitingQueueData = (waitingQueueData || []).filter(item => item.medecin?.actif !== false);

      // Récupérer les infos patients séparément
      const patientIds = Array.from(new Set(filteredWaitingQueueData.map(i => i.patient_id).filter(Boolean)));
      let patientMap = {};
      if (patientIds.length > 0) {
        const { data: patientsRows, error: patientsErr } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier')
          .in('id', patientIds);
        if (patientsErr) {
          console.warn('❗ [WaitingQueue] Erreur récupération patients:', patientsErr);
        } else {
          patientMap = Object.fromEntries((patientsRows || []).map(p => [p.id, p]));
        }
      }

      // Transformer les données de la file d'attente en format patients
      const rawPatientsData = filteredWaitingQueueData?.map(item => {
        const p = patientMap[item.patient_id] || {};
        return {
          id: item.id, // ID de la file d'attente
          patient_id: item.patient_id, // ID du patient
          appointment_id: item.appointment_id || null,
          nom: p.nom || '',
          prenom: p.prenom || '',
          telephone: p.telephone || '',
          heureArrivee: new Date(item.arrived_at || item.updated_at || item.created_at).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          status: item.status,
          priorite: item.priorite || 'normale',
          motif: item.motif_consultation || item.motif || 'Consultation',
          tempsAttente: Math.floor((new Date() - new Date(item.arrived_at || item.created_at || item.updated_at)) / 60000),
          medecin_id: item.medecin_id
        };
      }) || [];

      // Déduplication par appointment_id si dispo, sinon par (patient_id, medecin_id, status)
      const uniqueMap = new Map();
      for (const it of rawPatientsData) {
        const key = it.appointment_id
          ? `apt:${it.appointment_id}`
          : `p:${it.patient_id}-m:${it.medecin_id}-s:${it.status}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, it);
      }
      const patientsData = Array.from(uniqueMap.values());

      setPatients(patientsData);
      console.log('✅ [WaitingQueue] File d\'attente mise à jour:', patientsData.length, 'patients');
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur rechargement file d\'attente:', error);
    }
  };

  // Fonction pour recharger uniquement les rendez-vous
  const loadAppointmentsData = async () => {
    try {
      console.log('🔄 [WaitingQueue] Rechargement rendez-vous...');
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(nom, prenom, telephone, numero_dossier),
          medecin:users!inner(id, actif)
        `)
        .gte('date_heure', new Date().toISOString().split('T')[0])
        .order('date_heure', { ascending: false });

      if (appointmentsError) {
        console.error('❌ [WaitingQueue] Erreur rechargement rendez-vous:', appointmentsError);
        return;
      }

      // Filtrer pour ne montrer que les rendez-vous avec des médecins actifs
      const filteredAppointmentsData = (appointmentsData || []).filter(apt => apt.medecin?.actif !== false);

      // Transformer les rendez-vous en format attendu
      const transformedAppointments = filteredAppointmentsData?.map(apt => ({
        id: apt.id,
        patient_id: apt.patient_id,
        patient_nom: apt.patient?.nom || '',
        patient_prenom: apt.patient?.prenom || '',
        patient_telephone: apt.patient?.telephone || '',
        date_heure: apt.date_heure,
        motif: apt.motif || 'Consultation',
        medecin_id: apt.medecin_id,
        status: apt.status || 'programme'
      })) || [];

      setAppointments(transformedAppointments);
      console.log('✅ [WaitingQueue] Rendez-vous mis à jour:', transformedAppointments.length, 'rendez-vous');
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur rechargement rendez-vous:', error);
    }
  };

  // Charger les vraies données depuis Supabase (une seule fois)
  useEffect(() => {
    let mounted = true;

    const initializePage = async () => {
      if (!mounted) return;

      // Charger le profil utilisateur
      if (currentUser) {
        const profile = await getUserProfile();
        setUserProfile(profile);
      }

      // Charger les données une seule fois
      await loadData();

      // Configurer WebSocket après chargement des données
      await setupOptimizedRealtime();
    };

    initializePage();

    // Nettoyer au démontage
    return () => {
      mounted = false;
      cleanupOptimizedRealtime();
    };
  }, [currentUser]);

  const loadData = async () => {
    try {
      console.log('🔄 [WaitingQueue] Début du chargement des données...');
      setLoading(true);
      
      // Charger les patients depuis la file d'attente
      console.log('📋 [WaitingQueue] Récupération de la file d\'attente...');
      
      // Calculer les bornes de la date d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();
      
      const { data: waitingQueueData, error: waitingError } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          medecin:users!inner(id, actif),
          appointments(date_heure, statut_arrivee, heure_arrivee)
        `)
        .gte('appointments.date_heure', todayStart)
        .lt('appointments.date_heure', tomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive')
        .order('created_at', { ascending: false });

      if (waitingError) {
        console.error('❌ [WaitingQueue] Erreur file d\'attente:', waitingError);
        throw waitingError;
      }
      console.log('✅ [WaitingQueue] File d\'attente récupérée:', waitingQueueData?.length || 0, 'éléments');

      // Filtrer pour ne montrer que les entrées avec des médecins actifs
      const filteredWaitingQueueData = (waitingQueueData || []).filter(item => item.medecin?.actif !== false);

      // Récupérer les infos patients séparément
      const patientIds = Array.from(new Set(filteredWaitingQueueData.map(i => i.patient_id).filter(Boolean)));
      let patientMap = {};
      if (patientIds.length > 0) {
        const { data: patientsRows, error: patientsErr } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone, numero_dossier')
          .in('id', patientIds);
        if (patientsErr) {
          console.warn('❗ [WaitingQueue] Erreur récupération patients:', patientsErr);
        } else {
          patientMap = Object.fromEntries((patientsRows || []).map(p => [p.id, p]));
        }
      }

      // Transformer les données de la file d'attente en format patients
      const rawPatientsData = filteredWaitingQueueData?.map(item => {
        const p = patientMap[item.patient_id] || {};
        return {
          id: item.id, // ID de la file d'attente
          patient_id: item.patient_id, // ID du patient
          appointment_id: item.appointment_id || null,
          nom: p.nom || '',
          prenom: p.prenom || '',
          telephone: p.telephone || '',
          heureArrivee: new Date(item.created_at).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          status: item.status,
          priorite: item.priorite || 'normale',
          motif: item.motif_consultation || item.motif || 'Consultation',
          tempsAttente: Math.floor((new Date() - new Date(item.created_at)) / 60000),
          medecin_id: item.medecin_id
        };
      }) || [];
      const uniqueMap2 = new Map();
      for (const it of rawPatientsData) {
        const key = it.appointment_id
          ? `apt:${it.appointment_id}`
          : `p:${it.patient_id}-m:${it.medecin_id}-s:${it.status}`;
        if (!uniqueMap2.has(key)) uniqueMap2.set(key, it);
      }
      const patientsData = Array.from(uniqueMap2.values());
      console.log('🔄 [WaitingQueue] Patients transformés:', patientsData.length, 'patients');

      // Charger les rendez-vous
      console.log('📅 [WaitingQueue] Récupération des rendez-vous...');
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(nom, prenom, telephone, numero_dossier),
          medecin:users!inner(id, actif)
        `)
        .gte('date_heure', new Date().toISOString().split('T')[0])
        .order('date_heure', { ascending: true });

      if (appointmentsError) {
        console.error('❌ [WaitingQueue] Erreur rendez-vous:', appointmentsError);
        throw appointmentsError;
      }
      console.log('✅ [WaitingQueue] Rendez-vous récupérés:', appointmentsData?.length || 0, 'rendez-vous');

      // Filtrer pour ne montrer que les rendez-vous avec des médecins actifs
      const filteredAppointmentsData = (appointmentsData || []).filter(apt => apt.medecin?.actif !== false);

      // Transformer les rendez-vous en format attendu
      const transformedAppointments = filteredAppointmentsData?.map(apt => ({
        id: apt.id,
        patient_id: apt.patient_id, // Ajouter le patient_id manquant
        patient_nom: apt.patient?.nom || '',
        patient_prenom: apt.patient?.prenom || '',
        patient_telephone: apt.patient?.telephone || '',
        date_heure: apt.date_heure,
        motif: apt.motif || 'Consultation',
        medecin_id: apt.medecin_id,
        status: apt.status || 'programme'
      })) || [];
      console.log('🔄 [WaitingQueue] Rendez-vous transformés:', transformedAppointments.length, 'rendez-vous');

      // Charger les praticiens
      console.log('👨‍⚕️ [WaitingQueue] Récupération des praticiens...');
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('users')
        .select('id, nom, prenom, specialite, actif')
        .eq('role', 'praticien')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (doctorsError) {
        console.error('❌ [WaitingQueue] Erreur praticiens:', doctorsError);
        throw doctorsError;
      }

      console.log('✅ [WaitingQueue] Praticiens récupérés:', doctorsData?.length || 0, 'praticiens');

      const transformedDoctors = doctorsData?.map(doctor => ({
        id: doctor.id,
        nom: doctor.nom,
        prenom: doctor.prenom,
        specialite: doctor.specialite || 'Généraliste'
      })) || [];
      console.log('🔄 [WaitingQueue] Praticiens transformés:', transformedDoctors.length, 'praticiens');
      // Fallback: si aucun praticien n'est retourné via role='doctor', dériver depuis les rendez-vous
      let finalDoctors = transformedDoctors;
      if ((transformedDoctors?.length || 0) === 0) {
        const uniqueDoctorIds = Array.from(new Set((transformedAppointments || [])
          .map(a => a.medecin_id)
          .filter(Boolean)));
        if (uniqueDoctorIds.length > 0) {
          console.log('⚠️  [WaitingQueue] Aucun praticien via role=doctor, fallback par appointments, ids:', uniqueDoctorIds);
          const { data: doctorsById, error: doctorsByIdError } = await supabase
            .from('users')
            .select('id, nom, prenom, specialite, actif')
            .in('id', uniqueDoctorIds);
          if (doctorsByIdError) {
            console.warn('❗ [WaitingQueue] Erreur fallback praticiens par id:', doctorsByIdError);
          }
          if (doctorsById && doctorsById.length > 0) {
            finalDoctors = doctorsById.filter(d => d.actif !== false).map(d => ({
              id: d.id,
              nom: d.nom || `#${d.id}`,
              prenom: d.prenom || '',
              specialite: d.specialite || 'Généraliste'
            }));
          } else {
            // Dernier recours: placeholders à partir des IDs
            finalDoctors = uniqueDoctorIds.map(id => ({
              id,
              nom: `${getTitrePraticien()} ${id}`,
              prenom: '',
              specialite: 'N/A'
            }));
          }
          console.log('🔄 [WaitingQueue] Fallback praticiens transformés:', finalDoctors.length);
        }
      }

      setPatients(patientsData);
      setAppointments(transformedAppointments);
      setDoctors(finalDoctors);
      
      console.log('🎉 [WaitingQueue] Chargement terminé avec succès!');
      console.log('📊 [WaitingQueue] Résumé:', {
        patients: patientsData.length,
        appointments: transformedAppointments.length,
        doctors: transformedDoctors.length
      });
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les rendez-vous quand le praticien change
  useEffect(() => {
    if (selectedDoctor) {
      console.log('🔍 [WaitingQueue] Filtrage par praticien:', selectedDoctor.prenom, selectedDoctor.nom);
      const filtered = appointments.filter(a => a.medecin_id === selectedDoctor.id);
      console.log('📋 [WaitingQueue] Rendez-vous filtrés:', filtered.length, 'pour le praticien', selectedDoctor.id);
      setFilteredAppointments(filtered);
    } else {
      console.log('🔍 [WaitingQueue] Aucun filtre praticien actif');
      setFilteredAppointments([]);
    }
  }, [selectedDoctor, appointments]);

  // Fonctions pour gérer les actions
  const handleAddPatient = async (patientData) => {
    try {
      console.log('➕ [WaitingQueue] Ajout d\'un nouveau patient:', patientData);
      
      // Générer le numéro de dossier automatiquement
      const { generateNumeroDossier } = await import('../services/patientService');
      const numeroDossier = await generateNumeroDossier();
      
      // Créer le patient dans la base de données
      console.log('👤 [WaitingQueue] Création du patient dans la base...');
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert([{
          nom: patientData.nom,
          prenom: patientData.prenom,
          telephone: patientData.telephone,
          email: patientData.email || null,
          date_naissance: patientData.date_naissance || null,
          sexe: patientData.sexe || 'M',
          numero_dossier: numeroDossier
        }])
        .select()
        .single();

      if (patientError) {
        console.error('❌ [WaitingQueue] Erreur création patient:', patientError);
        throw patientError;
      }

      console.log('✅ [WaitingQueue] Patient créé:', newPatient);

      // Ajouter à la file d'attente
      const { data: waitingQueueItem, error: waitingQueueError } = await supabase
        .from('waiting_queue')
        .insert([{
          patient_id: newPatient.id,
          medecin_id: selectedDoctor?.id || null,
          status: 'en_attente',
          priorite: 'normale',
          motif: 'Consultation',
          date_arrivee: new Date().toISOString(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (waitingQueueError) {
        console.error('❌ [WaitingQueue] Erreur ajout file d\'attente:', waitingQueueError);
        throw waitingQueueError;
      }

      console.log('✅ [WaitingQueue] Patient ajouté à la file d\'attente:', waitingQueueItem);

      // Transformer et ajouter le patient à l'état local
      const transformedPatient = {
        id: waitingQueueItem.id,
        patient_id: newPatient.id,
        nom: newPatient.nom,
        prenom: newPatient.prenom,
        telephone: newPatient.telephone,
        date_arrivee: waitingQueueItem.date_arrivee,
        heure_arrivee: new Date(waitingQueueItem.date_arrivee).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit' 
        }),
        status: waitingQueueItem.status,
        priorite: waitingQueueItem.priorite || 'normale',
        motif: waitingQueueItem.motif || 'Consultation',
        tempsAttente: 0,
        medecin_id: waitingQueueItem.medecin_id
      };

      setPatients(prev => [...prev, transformedPatient]);
      
      console.log('🎉 [WaitingQueue] Patient ajouté avec succès:', transformedPatient.prenom, transformedPatient.nom);
      
      // Afficher un toast de succès
      if (window.showNotification) {
        window.showNotification({
          message: `Patient ${transformedPatient.prenom} ${transformedPatient.nom} ajouté à la salle d'attente !`,
          type: 'success',
          duration: 3000
        });
      }
      
      // Ne plus fermer automatiquement la modal - laisser l'utilisateur décider
      
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors de l\'ajout du patient:', error);
      if (window.showNotification) {
        window.showNotification({
          message: "Erreur lors de l'ajout du patient à la salle d'attente",
          type: 'error',
          duration: 5000
        });
      }
    }
  };
  const handleStartConsultation = async (patientId) => {
    try {
      console.log('🏥 [WaitingQueue] Démarrage consultation pour patient:', patientId);
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'in_consultation',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [WaitingQueue] Erreur démarrage consultation:', error);
        throw error;
      }
      console.log('✅ [WaitingQueue] Consultation démarrée pour patient:', patientId);
      
      // Mettre à jour l'état local au lieu de recharger toute la page
      setPatients(prev => prev.map(patient => 
        patient.id === patientId 
          ? { ...patient, status: 'in_consultation' }
          : patient
      ));
      
      // Afficher un toast de succès
      if (window.showNotification) {
        window.showNotification({
          message: 'Consultation démarrée avec succès !',
          type: 'success',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors du démarrage de la consultation:', error);
      
      // Afficher un toast d'erreur
      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors du démarrage de la consultation',
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  const handleCancelPatient = async (patientId) => {
    try {
      console.log('❌ [WaitingQueue] Annulation patient:', patientId);
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'absent',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [WaitingQueue] Erreur annulation patient:', error);
        throw error;
      }
      console.log('✅ [WaitingQueue] Patient annulé:', patientId);
      
      // Retirer le patient de la liste au lieu de recharger toute la page
      setPatients(prev => prev.filter(patient => patient.id !== patientId));
      
      // Afficher un toast d'information
      if (window.showNotification) {
        window.showNotification({
          message: 'Patient marqué comme absent',
          type: 'warning',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors de l\'annulation du patient:', error);
      
      // Afficher un toast d'erreur
      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors de l\'annulation du patient',
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  const handleMarkPresent = async (patientId) => {
    try {
      console.log('✅ [WaitingQueue] Marquage présent patient:', patientId);
      // Marquer le patient comme présent
      setPatientsPresents(prev => new Set([...prev, patientId]));
      
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'present',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [WaitingQueue] Erreur marquage présent:', error);
        throw error;
      }
      console.log('✅ [WaitingQueue] Patient marqué présent:', patientId);
      
      // Mettre à jour l'état local au lieu de recharger toute la page
      setPatients(prev => prev.map(patient => 
        patient.id === patientId 
          ? { ...patient, status: 'present' }
          : patient
      ));
      
      // Afficher un toast de succès
      if (window.showNotification) {
        window.showNotification({
          message: 'Patient marqué comme présent et ajouté à la file d\'attente !',
          type: 'success',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors du marquage présent:', error);
    }
  };

  // Fonction pour marquer un patient appelé comme présent
  const handleMarkCalledPatientPresent = async (patientId) => {
    try {
      console.log('✅ [WaitingQueue] Marquage patient appelé présent:', patientId);
      
      const { error } = await supabase
        .from('waiting_queue')
        .update({ 
          status: 'present',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) {
        console.error('❌ [WaitingQueue] Erreur marquage présent:', error);
        throw error;
      }

      console.log('✅ [WaitingQueue] Patient appelé marqué comme présent:', patientId);
      
      // Mettre à jour l'état local
      setPatients(prev => prev.map(patient => 
        patient.id === patientId 
          ? { ...patient, status: 'present' }
          : patient
      ));
      
      // Afficher un toast de succès
      if (window.showNotification) {
        window.showNotification({
          message: 'Patient marqué comme présent !',
          type: 'success',
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors du marquage présent:', error);
      
      // Afficher un toast d'erreur
      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors du marquage du patient comme présent',
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  // Nouvelle fonction pour inscrire un patient depuis un rendez-vous à la file d'attente
  const handleAddPatientFromAppointment = async (appointmentId) => {
    try {
      console.log('🔄 [WaitingQueue] Inscription patient depuis rendez-vous:', appointmentId);
      
      // Récupérer les détails du rendez-vous
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        throw new Error('Rendez-vous non trouvé');
      }

      console.log('📋 [WaitingQueue] Détails du rendez-vous:', {
        id: appointment.id,
        patient_id: appointment.patient_id,
        medecin_id: appointment.medecin_id,
        patient_nom: appointment.patient_nom,
        patient_prenom: appointment.patient_prenom
      });

      // Logique manuelle désactivée: l'ajout est automatique lors de la création du RDV
      if (window.showNotification) {
        window.showNotification({
          message: 'Ajout automatique déjà géré à la création du RDV',
          type: 'info',
          duration: 2500
        });
      }

      // Recharger la file pour refléter l'état courant
      await loadWaitingQueueData();
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur lors de l\'ajout du patient:', error);
      
      // Afficher un toast d'erreur
      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors de l\'ajout du patient: ' + error.message,
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  // Fonction pour envoyer un patient en consultation (secrétaire)
  const handleSendPatientToConsultation = async (waitingQueueId, medecinId) => {
    try {
      if (!userProfile?.id) {
        console.error('❌ [WaitingQueue] Profil utilisateur non disponible');
        return;
      }

      await secretaryService.sendPatientToConsultation(
        waitingQueueId,
        userProfile.id,
        medecinId
      );

      console.log('✅ [WaitingQueue] Patient envoyé en consultation via RPC');

      // Recharger la file d'attente
      await loadWaitingQueueData();
    } catch (error) {
      console.error('❌ [WaitingQueue] Erreur envoi patient en consultation:', error);

      if (window.showNotification) {
        window.showNotification({
          message: 'Erreur lors de l\'envoi du patient: ' + error.message,
          type: 'error',
          duration: 4000
        });
      }
    }
  };

  const getStatusBadge = (status, patient = null) => {
    // Si le statut est terminal (terminé, absent, etc.), ne pas afficher de badge
    if (isTerminalQueueStatus(status)) {
      return null;
    }

    // Vérifier si le rendez-vous est passé
    const isPast = patient && patient.appointment_id && patient.date_heure ? (() => {
      const appointmentTime = new Date(patient.date_heure);
      const durationMinutes = 30; // Durée par défaut
      const appointmentEndTime = new Date(appointmentTime.getTime() + durationMinutes * 60000);
      const now = new Date();
      return appointmentEndTime.getTime() < now.getTime();
    })() : false;

    // Si le rendez-vous est passé, afficher "En retard" en rouge
    if (isPast) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300 animate-pulse">
          En retard
        </span>
      );
    }

    const statusClasses = {
      en_attente: 'bg-yellow-100 text-yellow-800',
      appele: 'bg-purple-100 text-purple-800',
      en_consultation: 'bg-blue-100 text-blue-800',
      termine: 'bg-green-100 text-green-800',
      late: 'bg-red-100 text-red-800',
      emergency: 'bg-red-100 text-red-800',
      present: 'bg-blue-100 text-blue-800',
      called: 'bg-purple-100 text-purple-800',
      waiting: 'bg-yellow-100 text-yellow-800',
      finished: 'bg-green-100 text-green-800'
    };

    const statusLabels = {
      en_attente: 'En attente',
      appele: 'Appelé',
      en_consultation: 'En consultation',
      termine: 'Terminé',
      late: 'En retard',
      emergency: 'Urgence',
      present: 'Présent',
      called: 'Appelé',
      waiting: 'En attente',
      finished: 'Terminé'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || statusClasses.en_attente}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const getPriorityBadge = (priorite) => {
    const priorityClasses = {
      normale: 'bg-gray-100 text-gray-800',
      urgente: 'bg-orange-100 text-orange-800',
      tres_urgente: 'bg-red-100 text-red-800'
    };
    
    const priorityLabels = {
      normale: 'Normale',
      urgente: 'Urgente',
      tres_urgente: 'Très urgente'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityClasses[priorite] || priorityClasses.normale}`}>
        {priorityLabels[priorite] || priorite}
      </span>
    );
  };

  // Fonction pour vérifier si un patient est en retard
  const isPatientLate = (patient) => {
    if (!patient.appointment_id || !patient.date_heure) return false;
    const appointmentTime = new Date(patient.date_heure);
    const durationMinutes = 30; // Durée par défaut
    const appointmentEndTime = new Date(appointmentTime.getTime() + durationMinutes * 60000);
    const now = new Date();
    return appointmentEndTime.getTime() < now.getTime();
  };

  // Filtrer les patients selon le médecin sélectionné
  const patientsEnAttente = selectedDoctor
    ? patients.filter(p => (p.status === 'waiting' || p.status === 'called') && p.medecin_id === selectedDoctor.id)
    : patients.filter(p => p.status === 'waiting' || p.status === 'called');

  const patientsEnConsultation = selectedDoctor
    ? patients.filter(p => p.status === 'in_consultation' && p.medecin_id === selectedDoctor.id)
    : patients.filter(p => p.status === 'in_consultation');

  // Filtrer les patients en attente par recherche
  const filteredPatientsEnAttente = patientsEnAttente.filter(patient =>
    patient.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.motif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Trier les patients en attente : les patients en retard en premier
  const sortedPatientsEnAttente = [...filteredPatientsEnAttente].sort((a, b) => {
    const aIsLate = isPatientLate(a);
    const bIsLate = isPatientLate(b);
    
    // Les patients en retard d'abord
    if (aIsLate && !bIsLate) return -1;
    if (!aIsLate && bIsLate) return 1;
    
    // Ensuite, trier par priorité
    const priorityOrder = { 'tres_urgente': 0, 'urgente': 1, 'normale': 2 };
    const aPriority = priorityOrder[a.priorite] ?? 2;
    const bPriority = priorityOrder[b.priorite] ?? 2;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Enfin, trier par heure d'arrivée
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  // Fonction pour vérifier si un patient est présent
  const isPatientPresent = (patientId) => {
    return patientsPresents.has(patientId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la salle d'attente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* Header compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClockIcon className="w-6 h-6 text-medical-primary" />
            Salle d'attente
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              realtimeStatus === 'connected' 
                ? 'bg-green-100 text-green-800 animate-pulse' 
                : realtimeStatus === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800 animate-pulse'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-1 ${
                realtimeStatus === 'connected' 
                  ? 'bg-green-500' 
                  : realtimeStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}></div>
              {realtimeStatus === 'connected' 
                ? 'Temps réel' 
                : realtimeStatus === 'error'
                ? 'Erreur'
                : 'Connexion...'
              }
            </span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestion en temps réel
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="btn btn-secondary flex items-center gap-1 text-sm"
            title="Actualiser"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualiser
          </button>
          {realtimeStatus === 'error' && (
            <button 
              onClick={forceReconnect}
              className="btn btn-warning flex items-center gap-1 text-sm"
              title="Reconnexion"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Reconnexion
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowDoctorSearch(!showDoctorSearch)}
              className="btn btn-secondary flex items-center gap-1 text-sm"
            >
              <FunnelIcon className="w-4 h-4" />
              {selectedDoctor ? formatDoctorSpecialties(selectedDoctor) : 'Filtrer'}
            </button>
            
            {showDoctorSearch && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-200">
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {doctors
                    .filter(doctor => 
                      doctor.nom.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                      doctor.prenom.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                      doctor.specialite.toLowerCase().includes(doctorSearchTerm.toLowerCase())
                    )
                    .map((doctor) => (
                      <button
                        key={doctor.id}
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setShowDoctorSearch(false);
                          setDoctorSearchTerm('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 ${
                          selectedDoctor?.id === doctor.id 
                            ? 'bg-blue-50 border-2 border-blue-500' 
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                          {getDoctorInitials(doctor)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{formatDoctorSpecialties(doctor)}</p>
                          <p className="text-xs text-gray-600">Dr. {doctor.prenom} {doctor.nom}</p>
                        </div>
                      </button>
                    ))}
                </div>
                <div className="p-2 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedDoctor(null);
                      setShowDoctorSearch(false);
                      setDoctorSearchTerm('');
                    }}
                    className="w-full text-center text-xs text-gray-600 hover:text-gray-900 py-1.5 hover:bg-gray-50 rounded transition-colors"
                  >
                    Tous les patients
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistiques compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={ClockIcon}
          tone="blue"
          label={selectedDoctor ? `Attente - ${selectedDoctor.prenom}` : 'Total attente'}
          value={patientsEnAttente.length}
        />

        <KpiCard
          icon={CheckCircleIcon}
          tone="green"
          label={selectedDoctor ? `Consultation - ${selectedDoctor.prenom}` : 'En consultation'}
          value={patientsEnConsultation.length}
        />

        <KpiCard icon={XCircleIcon} tone="yellow" label="Temps moyen" value="18 min" />

        <KpiCard
          icon={XCircleIcon}
          tone="red"
          label="Urgences"
          value={patients.filter(p => p.priorite === 'urgente' || p.priorite === 'tres_urgente').length}
        />
      </div>

      {/* Salle d'attente compact */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-yellow-600" />
            En Attente ({patientsEnAttente.length})
            {selectedDoctor && (
              <span className="text-xs font-normal text-gray-500">
                - {selectedDoctor.prenom} {selectedDoctor.nom}
              </span>
            )}
          </h2>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 text-xs"
            />
          </div>
        </div>
        
        <div className="space-y-2 overflow-y-auto max-h-96">
          {sortedPatientsEnAttente.map((patient) => {
            const doctor = doctors.find(d => d.id === patient.medecin_id);
            const isFromAppointment = isPatientPresent(patient.id);
            const isCalled = patient.status === 'called';
            const isLate = isPatientLate(patient);
            
            return (
              <PatientQueueCard
                key={patient.id}
                patient={patient}
                doctor={doctor}
                isFromAppointment={isFromAppointment}
                isCalled={isCalled}
                isLate={isLate}
                onMarkPresent={(id) => isCalled ? handleMarkCalledPatientPresent(id) : handleMarkPresent(id)}
                onCancel={handleCancelPatient}
              />
            );
          })}
          
          {sortedPatientsEnAttente.length === 0 && (
            <div className="text-center py-6">
              <ClockIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucun patient en attente</p>
            </div>
          )}
        </div>
      </div>

      {/* Section Rendez-vous compact */}
      {selectedDoctor && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-medical-primary" />
              RDV {selectedDoctor.prenom} {selectedDoctor.nom} ({filteredAppointments.length})
            </h2>
            <p className="text-xs text-gray-600">
              {selectedDoctor.specialite}
            </p>
          </div>
          
          <div>
            {filteredAppointments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-96">
                {filteredAppointments.map((appointment) => {
                  const isPresent = isPatientPresent(appointment.id);
                  return (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      selectedDoctor={selectedDoctor}
                      isPresent={isPresent}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Aucun RDV pour {selectedDoctor.prenom} {selectedDoctor.nom}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal pour ajouter un nouveau patient */}
      {showAddPatientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <PatientForm
            doctors={doctors}
            onSubmit={handleAddPatient}
            onCancel={() => setShowAddPatientModal(false)}
            onAddAnother={() => {
              console.log('🔄 [WaitingQueue] Inscription d\'un autre patient');
            }}
            title="Inscrire un patient à la salle d'attente"
            submitText="Enregistrer et fermer"
            showAddAnother={true}
            defaultDoctor={selectedDoctor}
          />
        </div>
      )}
      
      {/* Panel de notifications temps réel */}
      <NotificationPanel 
        onNotificationAction={(action, notification) => {
          console.log('🔔 [WaitingQueue] Action notification:', action, notification);
          // Recharger les données après une action
          loadData();
        }}
      />

      {/* Diagnostic WebSocket - Affiché conditionnellement */}
      {showDiagnostic && (
        <div className="mt-6 space-y-4">
          <RealtimeTest />
          <WebSocketDiagnostic onStatusChange={setDiagnosticStatus} />
        </div>
      )}
    </div>
  );
};

export default WaitingQueuePage;

