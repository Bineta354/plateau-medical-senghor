import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { supabase } from '../../lib/supabase';
import { 
  fetchConsultations, 
  createConsultation as createConsultationService,
  updateConsultationStatus as updateStatusService,
  deleteConsultation as deleteConsultationService,
  generateRapport as generateRapportService
} from '../../services/consultation/consultationService';
import { fetchPatients } from '../../services/patientService';
import { getModelesConsultation } from '../../services/consultation/referenceDataService';
import { useNavigate } from 'react-router-dom';
import { normalizeConsultationType, getConsultationType, getConsultationMotif } from '../../utils/consultationUtils';

export const useConsultationsPage = () => {
    const navigate = useNavigate();
    const { showError, showSuccess, showWarning, showInfo } = useAlert();
    const { userProfile } = useAuth();
    
    // Data State
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [patients, setPatients] = useState([]);
    const [modeles, setModeles] = useState([]);
    
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [urgenceFilter, setUrgenceFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [showModeleModal, setShowModeleModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showVoirPlusModal, setShowVoirPlusModal] = useState(false);
    
    // Selection/Form State
    const [selectedConsultationId, setSelectedConsultationId] = useState(null);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [selectedModele, setSelectedModele] = useState('');
    const [motifConsultation, setMotifConsultation] = useState('');
    const [niveauUrgence, setNiveauUrgence] = useState('normale');
    const [typeConsultation, setTypeConsultation] = useState('standard');
    const [notesConfidentielles, setNotesConfidentielles] = useState('');

    const loadData = async () => {
        if (!userProfile?.id) return;
        
        setLoading(true);
        try {
            const [consultationsData, patientsData, modelesData] = await Promise.all([
                fetchConsultations({ doctorId: userProfile?.id }),
                fetchPatients(),
                getModelesConsultation()
            ]);
            
            setConsultations(consultationsData);
            setPatients(patientsData);
            setModeles(modelesData);
        } catch (err) {
            console.error(err);
            setError(err);
            showError("Erreur lors du chargement des données.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userProfile?.id]);

    const stats = useMemo(() => {
        const total = consultations.length;
        const enCours = consultations.filter(c => c.statut === 'en_cours').length;
        const terminees = consultations.filter(c => c.statut === 'terminee').length;
        const annulees = consultations.filter(c => c.statut === 'annulee').length;
        const urgentes = consultations.filter(c => c.niveau_urgence === 'urgente').length;
        const tresUrgentes = consultations.filter(c => c.niveau_urgence === 'tres_urgente').length;

        return { total, enCours, terminees, annulees, urgentes, tresUrgentes };
    }, [consultations]);

  const filteredConsultations = useMemo(() => {
      return consultations.filter(consultation => {
          const consultationMotif = getConsultationMotif(consultation).toLowerCase();
          const matchesSearch = 
            consultation.patients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            consultation.patients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            consultation.patients?.numero_dossier?.includes(searchTerm) ||
            consultationMotif.includes(searchTerm.toLowerCase());
          
          const matchesStatus = statusFilter === 'all' || consultation.statut === statusFilter;
          const matchesUrgence = urgenceFilter === 'all' || consultation.niveau_urgence === urgenceFilter;
          const matchesType = typeFilter === 'all' || normalizeConsultationType(getConsultationType(consultation)) === normalizeConsultationType(typeFilter);
          
          return matchesSearch && matchesStatus && matchesUrgence && matchesType;
      });
  }, [consultations, searchTerm, statusFilter, urgenceFilter, typeFilter]);

    const handleCreateConsultation = async () => {
        if (!selectedPatient || !motifConsultation.trim()) {
            showWarning('Veuillez sélectionner un patient et saisir un motif de consultation');
            return;
        }

        try {
            if (userProfile.role !== 'doctor') {
                showError('Seuls les médecins peuvent créer des consultations');
                return;
            }

            await createConsultationService({
                patient_id: parseInt(selectedPatient),
                medecin_id: userProfile.id,
                motif_consultation: motifConsultation.trim(),
                niveau_urgence: niveauUrgence,
                type_consultation: typeConsultation,
                notes_confidentielles: notesConfidentielles.trim() || null,
                statut: 'en_cours',
                date_consultation: new Date().toISOString()
            });

            showSuccess('Consultation créée avec succès');
            setShowModal(false);
            resetForm();
            loadData(); // Reload list
        } catch (error) {
           showError(error.message);
        }
    };

    const handleCreateFromModele = async () => {
        if (!selectedPatient || !selectedModele) {
            showWarning('Veuillez sélectionner un patient et un modèle');
            return;
        }

        try {
            const modele = modeles.find(m => m.id === parseInt(selectedModele));
             if (!modele) {
                showError('Modèle non trouvé');
                return;
            }

            if (userProfile.role !== 'doctor') {
                showError('Seuls les médecins peuvent créer des consultations');
                return;
            }

             await createConsultationService({
                patient_id: parseInt(selectedPatient),
                medecin_id: userProfile.id,
                motif_consultation: `Consultation ${modele.nom}`,
                niveau_urgence: 'normale',
                type_consultation: modele.type_consultation || 'standard',
                statut: 'en_cours',
                date_consultation: new Date().toISOString()
            });

            showSuccess(`Consultation créée avec succès`);
            setShowModeleModal(false);
            resetForm();
            loadData();
        } catch (error) {
            showError(error.message);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await updateStatusService(id, status);
            setConsultations(prev => prev.map(c => c.id === id ? { ...c, statut: status } : c));
        } catch(e) {
            showError("Erreur mise à jour statut");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette consultation ?')) return;
        try {
            await deleteConsultationService(id);
            setConsultations(prev => prev.filter(c => c.id !== id));
        } catch(e) {
            showError("Erreur lors de la suppression");
        }
    };
    
    const handleGenerateReport = async (id, format) => {
        try {
            showInfo(`Rapport ${format} en cours de génération...`);
            await generateRapportService(id, format);
        } catch(e) {
            showError("Erreur génération rapport");
        }
    };

    const resetForm = () => {
        setSelectedPatient('');
        setMotifConsultation('');
        setNiveauUrgence('normale');
        setTypeConsultation('standard');
        setNotesConfidentielles('');
        setSelectedModele('');
    };

    return {
        // Data & Loading
        loading,
        patients,
        modeles,
        stats,
        filteredConsultations,
        userProfile,

        // Filter Setters
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        urgenceFilter, setUrgenceFilter,
        typeFilter, setTypeFilter,

        // Modal State
        showModal, setShowModal,
        showModeleModal, setShowModeleModal,
        showExportModal, setShowExportModal,
        showVoirPlusModal, setShowVoirPlusModal,
        selectedConsultationId, setSelectedConsultationId,

        // Form State
        selectedPatient, setSelectedPatient,
        selectedModele, setSelectedModele,
        motifConsultation, setMotifConsultation,
        niveauUrgence, setNiveauUrgence,
        typeConsultation, setTypeConsultation,
        notesConfidentielles, setNotesConfidentielles,

        // Actions
        createConsultation: handleCreateConsultation,
        createConsultationFromModele: handleCreateFromModele,
        updateConsultationStatus: handleUpdateStatus,
        deleteConsultation: handleDelete,
        generateRapport: handleGenerateReport,
        resetForm,
        navigate
    };
};
