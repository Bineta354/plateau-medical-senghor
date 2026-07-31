import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { appointmentService } from '../../lib/services';
import { sendNotification, NOTIFICATION_TYPES } from '../../lib/notifications';
import { useConsultationData } from '../../hooks/consultation/useConsultationData';
import { createConsultationFromModele } from '../../services/consultation/referenceDataService';
import { getLastDentalStateForPatient } from '../../services/consultation/consultationService';
import ConstantesTab from '../../components/consultation/ConstantesTab';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { getConsultationMotif } from '../../utils/consultationUtils';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAlert } from '../../contexts/AlertContext';
import { useAuth } from '../../contexts/AuthContext';
import ConsultationDentalChart from '../../components/consultation/ConsultationDentalChart';
import PatientDocumentsViewer from '../../components/doctor/PatientDocumentsViewer';
import DevisModal from '../../components/consultation/modals/DevisModal';
import {
  ArrowLeft,
  User,
  Activity,
  Heart,
  Eye,
  Brain,
  FileText,
  Pill,
  CheckCircle,
  AlertCircle,
  Clock,
  Award,
  Printer,
  Stethoscope,
  FileImage,
  Star,
  X,
  Smile,
  Lock
} from 'lucide-react';
import { generateCertificatsPDF, generateSingleCertificatPDF } from '../../services/impression/certificatPdf';
import { printConsultationReport } from '../../services/impression/rapportConsultationPrint';
import AntecedentsMedicaux from '../../components/consultation/AntecedentsMedicaux';
import ExamenMedicaux from '../../components/consultation/ExamenMedicaux';
import AppareilsTab from '../../components/consultation/AppareilsTab';
import ActesTab from '../../components/consultation/ActesTab';
import OrdonnancesTab from '../../components/consultation/OrdonnancesTab';
import CertificatsTab from '../../components/consultation/CertificatsTab';
import SyntheseTab from '../../components/consultation/SyntheseTab';
import DiagnosticsTab from '../../components/consultation/DiagnosticsTab';

const ConsultationDetail = () => {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromWorkflow = (searchParams.get('from') === 'workflow');
  const waitingQueueId = searchParams.get('waiting_queue_id');

  const { dialogState, showConfirm, showSuccess: showSuccessDialog, closeDialog } = useConfirmDialog();
  const { showError, showWarning } = useAlert();
  const { userProfile, hasRole, tenantId } = useAuth();

  const id = paramId || searchParams.get('id');

  const {
    consultation,
    setConsultation,
    patient,
    loading,
    error,
    antecedents,
    constantes,
    signesCliniques,
    examensAppareils,
    syntheses,
    autresSignes,
    diagnostics,
    actes,
    ordonnances,
    certificats,
    dossierMedical,
    referenceData,
    modeles,
    syntheseHistorique,
    fetchSyntheseHistorique,
    refetchFunctions
  } = useConsultationData(id);

  const [activeTab, setActiveTab] = useState('examen'); // Examen général par défaut (obligatoire)
  const [syntheseMode, setSyntheseMode] = useState('current'); // 'current' ou 'history'

  // Fonction pour gérer le changement d'onglet avec validation
  const handleTabChange = (tabId) => {
    // Si on quitte l'onglet examen, vérifier qu'il est rempli
    if (activeTab === 'examen' && tabId !== 'examen') {
      if (!signesCliniques || signesCliniques.length === 0) {
        showError("Vous devez renseigner l'onglet 'Examen général' avant de passer à un autre onglet.");
        return;
      }
    }
    setActiveTab(tabId);
  };
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documentsStatus, setDocumentsStatus] = useState('none'); // 'none', 'new_today', 'old_only'
  const [showDevisModal, setShowDevisModal] = useState(false);

  // États pour les modals
  const [showConstanteModal, setShowConstanteModal] = useState(false);

  const [showModeleModal, setShowModeleModal] = useState(false);
  const [showCreateRdvModal, setShowCreateRdvModal] = useState(false);
  const [rdvForm, setRdvForm] = useState({
    date_heure: '',
    motif: '',
    duree: 30
  });

  const [showExamenDetailsModal, setShowExamenDetailsModal] = useState(false);
  const [selectedExamen, setSelectedExamen] = useState(null);
  const [medecinInfo, setMedecinInfo] = useState(null);
  const [consultationStarted, setConsultationStarted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [selectedModele, setSelectedModele] = useState('');
  const [fallbackDentalState, setFallbackDentalState] = useState(null);

  useEffect(() => {
    const fetchMedecinInfo = async () => {
      if (consultation?.medecin_id) {
        const { data, error } = await supabase
          .from('users')
          .select('id, nom, prenom, specialite, actif')
          .eq('id', consultation.medecin_id)
          .single();
        if (error) {
          console.error("Erreur lors de la récupération des informations du médecin:", error);
        } else {
          // Ne définir les infos du médecin que s'il est actif
          if (data?.actif !== false) {
            setMedecinInfo(data);
          } else {
            console.warn("Médecin inactif, informations non chargées");
            setMedecinInfo(null);
          }
        }
      }
    };
    fetchMedecinInfo();
  }, [consultation?.medecin_id]);

  useEffect(() => {
    if (patient?.id && syntheseMode === 'history') {
      fetchSyntheseHistorique(patient.id);
    }
  }, [syntheseMode, patient?.id, fetchSyntheseHistorique]);

  // Si cette consultation n'a pas encore d'état dentaire enregistré,
  // on va chercher le dernier état connu du patient (autre consultation,
  // même avec un autre médecin) pour ne jamais repartir de zéro.
  useEffect(() => {
    const loadFallbackDentalState = async () => {
      if (!patient?.id || !consultation?.id) return;

      const hasOwnState =
        consultation.dental_state &&
        Object.keys(consultation.dental_state).length > 0;

      if (hasOwnState) {
        setFallbackDentalState(null);
        return;
      }

      const lastState = await getLastDentalStateForPatient(patient.id, consultation.id);
      setFallbackDentalState(lastState);
    };

    loadFallbackDentalState();
  }, [patient?.id, consultation?.id, consultation?.dental_state]);

  useEffect(() => {
    if (consultation?.heure_debut_consultation) {
      setConsultationStarted(true);
      const startTime = new Date(consultation.heure_debut_consultation);
      const now = new Date();
      const elapsed = Math.floor((now - startTime) / 1000 / 60);
      setElapsedTime(elapsed);
    }
  }, [consultation]);


  // Timer pour afficher le temps écoulé en temps réel
  useEffect(() => {
    if (consultationStarted && consultation?.heure_debut_consultation && !consultation?.heure_fin_consultation) {
      const timer = setInterval(() => {
        const startTime = new Date(consultation.heure_debut_consultation);
        const currentTime = new Date();
        const elapsedMinutes = Math.floor((currentTime - startTime) / 1000 / 60); // en minutes
        setElapsedTime(elapsedMinutes);
      }, 60000);

      return () => clearInterval(timer);
    }
  }, [consultationStarted, consultation?.heure_debut_consultation, consultation?.heure_fin_consultation]);

  // Gérer l'onglet depuis les paramètres URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const validTabs = ['antecedents', 'constantes', 'examen', 'appareils', 'diagnostics', 'actes', 'ordonnances', 'certificats', 'synthese', 'dental'];
      if (validTabs.includes(tabParam)) {
        setActiveTab(tabParam);
      }
    } else {
      // Si aucun paramètre tab, s'assurer que l'onglet examen est actif par défaut
      setActiveTab('examen');
    }
  }, [searchParams]);

  useEffect(() => {
    if (dossierMedical.documentsPatient.length > 0) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const hasNewToday = dossierMedical.documentsPatient.some(doc => {
        const docDate = new Date(doc.created_at);
        return docDate >= todayStart && docDate <= todayEnd;
      });
      setDocumentsStatus(hasNewToday ? 'new_today' : 'old_only');
    } else {
      setDocumentsStatus('none');
    }
  }, [dossierMedical.documentsPatient]);


  const handleFinishWorkflow = async () => {
    // Vérification obligatoire : l'onglet Examen général doit être renseigné
    if (!signesCliniques || signesCliniques.length === 0) {
      showError("Vous devez renseigner l'onglet 'Examen général' avant de terminer la consultation.");
      setActiveTab('examen');
      return;
    }
    if (!consultation || !consultation.id) {
      console.error('❌ [Consultation] Consultation ou ID invalide:', consultation);
      return;
    }

    try {
      console.log('🔵 [Consultation] Début de la terminaison de consultation');

      const endTime = new Date().toISOString();
      const { error: saveError } = await supabase
        .from('consultations')
        .update({
          statut: 'terminee',
          notes_generales: consultation.notes_generales || null,
          updated_at: endTime
        })
        .eq('id', consultation.id);

      if (saveError) {
        console.warn('⚠️ [Consultation] Erreur lors de la sauvegarde automatique:', saveError);
      } else {
        setConsultation({ ...consultation, statut: 'terminee', updated_at: endTime });
      }

      console.log('📤 [Consultation] Envoi de la notification à la secrétaire...');
      const { data: secretaireData } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'secretary')
        .eq('actif', true)
        .limit(1)
        .single();

      if (secretaireData) {
        await sendNotification(
          NOTIFICATION_TYPES.CONSULTATION_ENDED,
          consultation.medecin_id,
          secretaireData.id,
          consultation.id,
          `${patient.prenom} ${patient.nom}`,
          {
            patientId: consultation.patient_id,
          }
        );
      } else {
        console.warn("Aucune secrétaire active trouvée pour la notification.");
      }

      console.log('📝 [Consultation] Mise à jour du statut de la consultation...');
      if (!consultation || !consultation.id) {
        console.error('❌ [Consultation] Consultation ou ID invalide pour mise à jour statut:', consultation);
        return;
      }
      const { data: updatedConsultation, error: cErr } = await supabase
        .from('consultations')
        .update({ statut: 'terminee', updated_at: new Date().toISOString() })
        .eq('id', consultation.id)
        .select()
        .single();

      if (cErr) {
        showWarning(`Attention: Le statut de la consultation n'a pas pu être mis à jour: ${cErr.message}`);
      } else {
        if (updatedConsultation) setConsultation(updatedConsultation);
      }

      console.log('🔄 [Consultation] Mise à jour de la file d\'attente...');
      console.log('📋 [Consultation] waitingQueueId:', waitingQueueId);
      if (waitingQueueId) {
        const { error: statusError } = await supabase
          .from('waiting_queue')
          .update({
            status: 'termine',
            consultation_ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', Number(waitingQueueId));

        if (statusError) {
          console.error('❌ [Consultation] Erreur mise à jour waiting_queue:', statusError);
          showWarning(`Attention: Le statut de la salle d'attente n'a pas pu être mis à jour: ${statusError.message}`);
        } else {
          console.log('✅ [Consultation] waiting_queue mis à jour avec succès');
        }
      } else {
        console.warn('⚠️ [Consultation] waitingQueueId manquant, impossible de mettre à jour la file d\'attente');
      }
      // Synchroniser appointments.statut avec la fin de consultation
      if (consultation?.appointment_id) {
        const { error: apptStatusError } = await supabase
          .from('appointments')
          .update({
            statut: 'termine',
            updated_at: new Date().toISOString()
          })
          .eq('id', consultation.appointment_id);
        if (apptStatusError) {
          console.error('❌ [Consultation] Erreur mise à jour appointments:', apptStatusError);
          showWarning(`Attention: Le statut du rendez-vous n'a pas pu être mis à jour: ${apptStatusError.message}`);
        } else {
          console.log('✅ [Consultation] appointments.statut mis à jour à "termine"');
        }
      } else {
        console.warn('⚠️ [Consultation] appointment_id manquant, impossible de mettre à jour appointments');
      }


      await showSuccessDialog('Consultation terminée', `La consultation a été terminée avec succès. La secrétaire a été notifiée.`);
      await showConfirm({
        title: 'Planifier un rendez-vous de suivi ?',
        message: `Souhaitez-vous créer un prochain rendez-vous pour ${patient?.prenom} ${patient?.nom} ?`,
        type: 'info',
        confirmText: 'Oui, planifier',
        cancelText: 'Non, terminer',
        showCancel: true,
        onConfirm: () => setShowCreateRdvModal(true),
        onCancel: () => {
          setTimeout(() => {
            window.location.hash = '#/dashboard';
            navigate('/dashboard', { replace: true });
          }, 100);
        }
      });
    } catch (e) {
      console.error('Erreur fin de consultation:', e);
      showError(`Erreur lors de la fin de consultation: ${e?.message || e}`);
    }
  };

  const handlePrintReport = async () => {
    await printConsultationReport(
      supabase,
      patient,
      consultation,
      antecedents,
      constantes,
      signesCliniques,
      examensAppareils,
      syntheses,
      diagnostics,
      ordonnances,
      certificats,
      tenantId
    );
  };

  const createConsultationFromModeleForPatient = async () => {
    if (!patient || !selectedModele) {
      showWarning('Veuillez sélectionner un modèle');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Utilisateur non connecté');
        return;
      }
      const { data: userProfile } = await supabase.from('users').select('id, role').eq('email', user.email).single();
      if (!userProfile || userProfile.role !== 'doctor') {
        showError('Profil médecin introuvable');
        return;
      }

      const newConsultation = await createConsultationFromModele(patient.id, selectedModele, userProfile.id);

      setShowModeleModal(false);
      setSelectedModele('');
      const qs = `?from=workflow${waitingQueueId ? `&waiting_queue_id=${waitingQueueId}` : ''}`;
      navigate(`/consultation/${newConsultation.id}${qs}`);
    } catch (err) {
      console.error('Erreur création consultation modèle:', err);
      showError('Erreur lors de la création de la consultation modèle');
    }
  };

  const handleCreateRdv = async () => {
    if (!patient || !consultation) return;

    try {
      console.log('🔄 [Consultation] Envoi demande RDV de suivi à la secrétaire');

      // Récupérer une secrétaire active du cabinet
      const { data: secretaires } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'secretary')
        .eq('actif', true)
        .limit(1);

      if (!secretaires || secretaires.length === 0) {
        throw new Error('Aucune secrétaire active trouvée');
      }

      const secretaireId = secretaires[0].id;
      const patientName = `${patient.prenom} ${patient.nom}`;
      const message = `Dr ${userProfile?.nom || ''} - RDV suivi ${patient.prenom} ${patient.nom} - ${new Date(rdvForm.date_heure).toLocaleDateString('fr-FR')} ${new Date(rdvForm.date_heure).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} - ${rdvForm.motif || 'Suivi'} - ${rdvForm.duree}min`;

      // Envoyer une notification à la secrétaire avec les détails du rendez-vous demandé
      await sendNotification(
        'appointment_request',
        userProfile?.id,
        secretaireId,
        consultation.id,
        patientName,
        {
          patient_id: patient.id,
          medecin_id: consultation.medecin_id,
          suggested_date: rdvForm.date_heure,
          motif: rdvForm.motif || 'Suivi',
          duree: rdvForm.duree,
          message: message
        }
      );

      setShowCreateRdvModal(false);
      setRdvForm({
        date_heure: '',
        motif: '',
        duree: 30
      });

      showSuccessDialog('Demande envoyée', 'La demande de rendez-vous a été envoyée à la secrétaire pour confirmation.');

      // Redirection vers le dashboard après envoi de la demande
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
      
    } catch (error) {
      console.error('❌ [Consultation] Erreur création RDV:', error);
      showError('Erreur lors de la création du rendez-vous: ' + error.message);
    }
  };

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return null;
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'en_cours':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'terminee':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'annulee':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_cours':
        return 'bg-blue-100 text-blue-800';
      case 'terminee':
        return 'bg-green-100 text-green-800';
      case 'annulee':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const isDentist = hasRole('doctor') && (
    userProfile?.specialite?.toLowerCase().includes('dent') || 
    userProfile?.specialite?.toLowerCase().includes('orthodontiste') ||
    userProfile?.specialite?.toLowerCase().includes('chirurgien buccal') ||
    userProfile?.specialite?.toLowerCase().includes('endodont') ||
    userProfile?.specialite?.toLowerCase().includes('parodont') ||
    userProfile?.specialite?.toLowerCase().includes('pédodont') ||
    userProfile?.specialite?.toLowerCase().includes('pedodont') ||
    userProfile?.specialite?.toLowerCase().includes('prosthodont')
  );
  
  // Debug log
  console.log('🦷 [Consultation] isDentist:', isDentist, 'specialite:', userProfile?.specialite);
  const isTerminated = consultation?.statut === 'terminee';

  const tabs = [
    { id: 'examen', name: 'Examen Général', icon: Eye },
    { id: 'antecedents', name: 'Antécédents', icon: User },
    { id: 'constantes', name: 'Constantes', icon: Activity },
    { id: 'appareils', name: 'Appareils', icon: Heart },
    { id: 'diagnostics', name: 'Diagnostics', icon: FileText },
    ...(isDentist ? [{ id: 'dental', name: 'Schéma Dentaire', icon: Smile }] : []),
    { id: 'actes', name: 'Actes', icon: Stethoscope },
    { id: 'ordonnances', name: 'Ordonnances', icon: Pill },
    { id: 'certificats', name: 'Certificats', icon: Award },
    { id: 'synthese', name: 'Synthèse', icon: Brain }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Consultation non trouvée</h2>
          <p className="text-gray-600 mt-2">
            {error ? `Erreur: ${error.message}` : "La consultation demandée n'existe pas."}
          </p>
          <button
            onClick={() => navigate('/consultations')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retour aux consultations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="mb-6">
        <button
          onClick={() => navigate(fromWorkflow ? '/doctor' : '/consultations')}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux consultations
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Consultation - {patient?.prenom} {patient?.nom}
            </h1>
            <p className="text-gray-600 mt-1">
              Dossier: {patient?.numero_dossier} •
              {patient?.date_naissance && ` ${calculateAge(patient.date_naissance)} ans`} •
              {patient?.sexe && ` ${patient.sexe}`}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {formatDate(consultation.date_consultation)} •
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(consultation.statut)}`}>
                {getStatusIcon(consultation.statut)}
                <span className="ml-1 capitalize">
                  {consultation.statut.replace('_', ' ')}
                </span>
              </span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Motif de consultation</p>
            <p className="text-gray-900 font-medium">{getConsultationMotif(consultation) || 'Aucun motif spécifié'}</p>
            <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
              {consultationStarted && consultation?.heure_debut_consultation && !consultation?.heure_fin_consultation && (
                <div className="flex items-center px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-sm border border-blue-200">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>
                    Temps écoulé: {elapsedTime !== null ? `${elapsedTime} min` : 'Calcul...'}
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowDocumentsModal(true)}
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-white text-sm transition-colors ${documentsStatus === 'none'
                  ? 'bg-gray-500 hover:bg-gray-600'
                  : documentsStatus === 'new_today'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                <FileImage className="w-4 h-4 mr-1" /> Documents
              </button>

              <button
                onClick={() => setShowDevisModal(true)}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 transition-colors"
              >
                <FileText className="w-4 h-4 mr-1" /> Faire un devis
              </button>

              {fromWorkflow && (
                <>
                  <button
                    onClick={() => setShowModeleModal(true)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                  >
                    <Star className="w-4 h-4 mr-1" /> Modèle
                  </button>
                  <button
                    onClick={handlePrintReport}
                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 text-sm hover:bg-gray-300"
                  >
                    <Printer className="w-4 h-4 mr-1" /> Imprimer
                  </button>
                  <button
                    onClick={handleFinishWorkflow}
                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Terminer consultation
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Read-only banner for terminated consultations */}
      {isTerminated && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center">
          <Lock className="w-5 h-5 text-amber-600 mr-3" />
          <div>
            <p className="text-amber-800 font-medium">Consultation terminée — Lecture seule</p>
            <p className="text-amber-600 text-sm">
              {consultation?.heure_fin_consultation 
                ? `Terminée le ${new Date(consultation.heure_fin_consultation).toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                : 'Cette consultation ne peut plus être modifiée.'}
            </p>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex flex-col space-y-2">
          {/* Rangée 1 */}
          <nav className="-mb-px flex space-x-8 flex-wrap">
            {tabs.filter(tab => ['examen', 'antecedents', 'constantes', 'appareils', 'diagnostics'].includes(tab.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>

          {/* Rangée 2 */}
          <nav className="-mb-px flex space-x-8 flex-wrap">
            {tabs.filter(tab => ['actes', 'ordonnances', 'certificats', 'synthese', 'dental'].includes(tab.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'antecedents' && (
          <AntecedentsMedicaux
            antecedents={antecedents}
            fetchAntecedents={refetchFunctions.refetchAntecedents}
            antecedentsRef={referenceData.antecedentsRef}
            patient={patient}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'constantes' && (
          <ConstantesTab
            consultationId={id}
            activeTab={activeTab}
            showAddModal={showConstanteModal}
            onCloseAddModal={() => setShowConstanteModal(false)}
            onOpenAddModal={() => setShowConstanteModal(true)}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'examen' && (
          <ExamenMedicaux
            fetchSignesCliniques={refetchFunctions.refetchSignesCliniques}
            signesCliniques={signesCliniques}
            autresSignes={autresSignes}
            signesCliniquesRef={referenceData.signesCliniquesRef}
            fetchAutresSignesCliniques={refetchFunctions.refetchAutresSignes}
            id={consultation.id}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'appareils' && (
          <AppareilsTab
            examensAppareils={examensAppareils}
            setSelectedExamen={setSelectedExamen}
            setShowExamenDetailsModal={setShowExamenDetailsModal}
            consultation={consultation}
            setMedecinInfo={setMedecinInfo}
            fetchExamensAppareils={refetchFunctions.refetchExamensAppareils}
            appareilsRef={referenceData.appareilsRef}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'diagnostics' && (
          <DiagnosticsTab
            diagnostics={diagnostics}
            fetchDiagnostics={refetchFunctions.refetchDiagnostics}
            diagnosticsRef={referenceData.diagnosticsRef}
            id={consultation.id}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'actes' && (
          <ActesTab
            actes={actes}
            fetchActes={refetchFunctions.refetchActes}
            actesRef={referenceData.actesRef}
            id={consultation.id}
            patient={patient}
            consultation={consultation}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'ordonnances' && (
          <OrdonnancesTab
            ordonnances={ordonnances}
            fetchOrdonnances={refetchFunctions.refetchOrdonnances}
            id={consultation.id}
            medicamentsRef={referenceData.medicamentsRef}
            patient={patient}
            calculateAge={calculateAge}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'certificats' && (
          <CertificatsTab
            certificats={certificats}
            fetchCertificats={refetchFunctions.refetchCertificats}
            typesCertificatsRef={referenceData.typesCertificatsRef}
            id={consultation.id}
            consultation={consultation}
            generateCertificatsPDF={() => generateCertificatsPDF(supabase, certificats, patient, medecinInfo, tenantId)}
            generateSingleCertificatPDF={(certificat) => generateSingleCertificatPDF(supabase, certificat, patient, medecinInfo, tenantId)}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'synthese' && (
          <SyntheseTab
            id={id}
            patient={patient}
            consultation={consultation}
            antecedents={antecedents}
            constantes={constantes}
            signesCliniques={signesCliniques}
            examensAppareils={examensAppareils}
            diagnostics={diagnostics}
            ordonnances={ordonnances}
            certificats={certificats}
            syntheses={syntheses}
            syntheseHistorique={syntheseHistorique}
            elementsSyntheseRef={referenceData.elementsSyntheseRef}
            fetchSyntheses={refetchFunctions.refetchSyntheses}
            syntheseMode={syntheseMode}
            setSyntheseMode={setSyntheseMode}
            isTerminated={isTerminated}
          />
        )}
        {activeTab === 'dental' && isDentist && (
          <div className="p-6">
            <ConsultationDentalChart
              consultationId={id}
              initialDentalState={
                (consultation.dental_state && Object.keys(consultation.dental_state).length > 0)
                  ? consultation.dental_state
                  : (fallbackDentalState || {})
              }
              fetchActes={refetchFunctions.refetchActes}
              patientId={patient?.id}
              isTerminated={isTerminated}
              onSaved={(updated) => {
                if (updated) {
                  setConsultation((prev) => ({ ...prev, dental_state: updated.dental_state }));
                }
                refetchFunctions.refetchActes();
              }}
            />
          </div>
        )}
      </div>

      {/* Modals... */}
      {/* Modal Modèle (workflow) */}
      {showModeleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Créer depuis un modèle</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modèle *</label>
                  <select
                    value={selectedModele}
                    onChange={(e) => setSelectedModele(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner un modèle</option>
                    {modeles.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModeleModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  onClick={createConsultationFromModeleForPatient}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autres modals (Upload, Document Viewer, Examen Details, ConfirmDialog, etc.) restent les mêmes */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
      />
      {showDocumentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileImage className="text-blue-600" size={28} />
                  Documents du patient
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {patient?.prenom} {patient?.nom} - Documents uploadés en salle d&apos;attente
                </p>
              </div>
              <button
                onClick={() => setShowDocumentsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <PatientDocumentsViewer
                patient={patient}
                consultationId={consultation?.id || null}
              />
            </div>
          </div>
        </div>
      )}
      {showDevisModal && (
        <DevisModal
          patientId={patient?.id || null}
          patientNom={patient?.nom || 'Patient'}
          patientPrenom={patient?.prenom || 'Inconnu'}
          medecinId={consultation?.medecin_id || null}
          medecinNom={consultation?.medecin_nom || 'Médecin'}
          onClose={() => setShowDevisModal(false)}
        />
      )}
      
      {/* Modal Planifier Rendez-vous */}
      {showCreateRdvModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Planifier un rendez-vous de suivi</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Délai suggéré</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 7);
                        setRdvForm({...rdvForm, date_heure: date.toISOString().slice(0, 16)});
                      }}
                      className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Dans 1 semaine
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 14);
                        setRdvForm({...rdvForm, date_heure: date.toISOString().slice(0, 16)});
                      }}
                      className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Dans 2 semaines
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() + 1);
                        setRdvForm({...rdvForm, date_heure: date.toISOString().slice(0, 16)});
                      }}
                      className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Dans 1 mois
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() + 3);
                        setRdvForm({...rdvForm, date_heure: date.toISOString().slice(0, 16)});
                      }}
                      className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Dans 3 mois
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure *</label>
                  <input
                    type="datetime-local"
                    value={rdvForm.date_heure}
                    onChange={(e) => setRdvForm({...rdvForm, date_heure: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motif de la consultation</label>
                  <input
                    type="text"
                    value={rdvForm.motif}
                    onChange={(e) => setRdvForm({...rdvForm, motif: e.target.value})}
                    placeholder="Ex: Contrôle de suivi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
                  <select
                    value={rdvForm.duree}
                    onChange={(e) => setRdvForm({...rdvForm, duree: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateRdvModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateRdv}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Envoyer à la secrétaire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationDetail;