import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
// Import des icônes lucide-react - FINAL FIXED VERSION
import {
  Users,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Calendar,
  MapPin,
  User,
  Heart,
  FileText,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getPatientUniqueConstraintMessage } from '../schemas/patientSchema';
import PatientPostCreateMenu from '../components/common/PatientPostCreateMenu';
import KpiCard from '../components/common/KpiCard';
import Dropdown from '../components/common/Dropdown';
import { formatTelephoneSN, isValidTelephoneSN, TELEPHONE_PLACEHOLDER } from '../utils/phone';

const PatientsPage = () => {
  console.log('🔄 [PatientsFinal] Chargement de la page Patients - VERSION FINALE');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasRole, userProfile } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consultationsCount, setConsultationsCount] = useState(0);

  // Vérifier si l'utilisateur est secrétaire (ne peut pas supprimer)
  const isSecretary = hasRole('secretary');
  const isDoctor = hasRole('doctor');
  // Patients ayant au moins une consultation avec le médecin connecté — même
  // définition que celle historiquement utilisée pour "Mes Patients" (voir
  // MesPatients.jsx / consultations.medecin_id), la seule qui reflète la
  // réalité des données (medecin_traitant_id n'est quasiment jamais renseigné).
  const [myPatientIds, setMyPatientIds] = useState(new Set());
  const [showOnlyMine, setShowOnlyMine] = useState(isDoctor);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [filters, setFilters] = useState({
    sexe: 'all',
    situation_familiale: 'all',
    mutuelle: '',
    medecin_traitant: '',
    ageMin: '',
    ageMax: ''
  });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    sexe: 'M',
    telephone: '',
    email: '',
    adresse: '',
    numero_dossier: '',
    lieu_naissance: '',
    nationalite: 'Sénégalais(e)',
    profession: '',
    situation_familiale: '',
    numero_ipm: '',
    groupe_sanguin: '',
    medecin_traitant: '',
    mutuelle: '',
    numero_mutuelle: '',
    assurance_id: null,
    nom_assurance: '',
    numero_assurance: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    actif: true,
    notes: ''
  });
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [createdPatient, setCreatedPatient] = useState(null);
  const [showPostCreateMenu, setShowPostCreateMenu] = useState(false);
  const [assurances, setAssurances] = useState([]);
  const [loadingAssurances, setLoadingAssurances] = useState(false);

  // Charger les patients depuis la base de données
  useEffect(() => {
    fetchPatients();
    fetchConsultationsCount();
    fetchAssurances();
  }, []);

  // Patients du médecin connecté (pour le switch "Mes patients" et le badge
  // dans la vue globale).
  useEffect(() => {
    if (!isDoctor || !userProfile?.id) {
      setMyPatientIds(new Set());
      return;
    }

    const fetchMyPatientIds = async () => {
      try {
        const { data, error } = await supabase
          .from('consultations')
          .select('patient_id')
          .eq('medecin_id', userProfile.id);

        if (error) throw error;
        setMyPatientIds(new Set((data || []).map((c) => c.patient_id).filter(Boolean)));
      } catch (error) {
        console.error('Erreur lors du chargement des patients du médecin:', error);
      }
    };

    fetchMyPatientIds();
  }, [isDoctor, userProfile?.id]);

  // Ouvrir directement le modal "Nouveau patient" via ?new=true (ex. depuis
  // le bouton "Créer fiche patient" du dashboard secrétaire). On attend que
  // le chargement initial (patients, assurances) soit terminé — même
  // condition qu'un clic réel sur "Nouveau Patient", qui n'arrive qu'une
  // fois la page chargée.
  useEffect(() => {
    if (searchParams.get('new') === 'true' && !loading) {
      handleAddPatient();
      // Nettoyer le paramètre pour ne pas rouvrir le modal à chaque re-render
      navigate('/patients', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  // Gérer les paramètres URL pour l'édition/visualisation
  useEffect(() => {
    const patientId = searchParams.get('id');
    const isEdit = searchParams.get('edit') === 'true';
    const isView = searchParams.get('view') === 'true';

    if (patientId) {
      const patient = patients.find(p => p.id.toString() === patientId);
      if (patient) {
        setSelectedPatient(patient);
        if (isEdit) {
          setFormData({
            nom: patient.nom || '',
            prenom: patient.prenom || '',
            date_naissance: patient.date_naissance || '',
            sexe: patient.sexe || 'M',
            telephone: patient.telephone || '',
            email: patient.email || '',
            adresse: patient.adresse || '',
            numero_dossier: patient.numero_dossier || '',
            lieu_naissance: patient.lieu_naissance || '',
            nationalite: patient.nationalite || 'sénégalais(e)',
            profession: patient.profession || '',
            situation_familiale: patient.situation_familiale || '',
            numero_ipm: patient.numero_ipm || '',
            groupe_sanguin: patient.groupe_sanguin || '',
            medecin_traitant: patient.medecin_traitant || '',
            mutuelle: patient.mutuelle || '',
            numero_mutuelle: patient.numero_mutuelle || '',
            assurance_id: patient.assurance_id || null,
            nom_assurance: patient.nom_assurance || '',
            numero_assurance: patient.numero_assurance || '',
            personne_contact: patient.personne_contact || '',
            telephone_contact: patient.telephone_contact || '',
            lien_contact: patient.lien_contact || '',
            actif: patient.actif !== undefined ? patient.actif : true,
            notes: patient.notes || ''
          });
          setEditingPatientId(patient.id);
          setShowForm(true);
        }
      }
    }
  }, [searchParams, patients]);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultationsCount = async () => {
    try {
      const { data, error } = await supabase
        .from('waiting_queue')
        .select('id')
        .eq('status', 'in_consultation');

      if (error) throw error;
      setConsultationsCount(data?.length || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des consultations:', error);
      setConsultationsCount(0);
    }
  };

  const fetchAssurances = async () => {
    try {
      setLoadingAssurances(true);
      const { data, error } = await supabase
        .from('assurances')
        .select('*')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (error) throw error;
      setAssurances(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des assurances:', error);
    } finally {
      setLoadingAssurances(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.telephone?.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'actif' && patient.actif) ||
      (filterStatus === 'inactif' && !patient.actif);
    
    // Filtres avancés
    const matchesSexe = filters.sexe === 'all' || patient.sexe === filters.sexe;
    
    const matchesSituationFamiliale = filters.situation_familiale === 'all' || 
      patient.situation_familiale === filters.situation_familiale;
    
    const matchesMutuelle = !filters.mutuelle || 
      patient.mutuelle?.toLowerCase().includes(filters.mutuelle.toLowerCase());
    
    const matchesMedecin = !filters.medecin_traitant || 
      patient.medecin_traitant?.toLowerCase().includes(filters.medecin_traitant.toLowerCase());
    
    // Filtre par âge
    let matchesAge = true;
    if (filters.ageMin || filters.ageMax) {
      const age = calculateAge(patient.date_naissance);
      if (filters.ageMin && age < parseInt(filters.ageMin)) {
        matchesAge = false;
      }
      if (filters.ageMax && age > parseInt(filters.ageMax)) {
        matchesAge = false;
      }
    }

    const matchesMine = !isDoctor || !showOnlyMine || myPatientIds.has(patient.id);

    return matchesSearch && matchesFilter && matchesSexe && matchesSituationFamiliale &&
           matchesMutuelle && matchesMedecin && matchesAge && matchesMine;
  });

  // Revenir à la première page dès que la liste filtrée change, sinon on peut
  // se retrouver sur une page vide (ex: recherche qui réduit le nombre de résultats).
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filters, showOnlyMine]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  const handlePreviousPage = () => setCurrentPage((page) => Math.max(1, page - 1));
  const handleNextPage = () => setCurrentPage((page) => Math.min(totalPages, page + 1));

  const getStatusBadge = (actif) => {
    const statusClasses = {
      true: 'bg-green-100 text-green-800',
      false: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[actif] || statusClasses.false}`}>
        {actif ? 'Actif' : 'Inactif'}
      </span>
    );
  };

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return '';
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleViewPatient = (patient) => {
    // Utiliser la route fiche-patient qui est accessible aux médecins
    navigate(`/rendez-vous/fiche-patient?id=${patient.id}`);
  };

  const handleEditPatient = (patient) => {
    setFormData({
      nom: patient.nom || '',
      prenom: patient.prenom || '',
      date_naissance: patient.date_naissance || '',
      sexe: patient.sexe || 'M',
      telephone: patient.telephone || '',
      email: patient.email || '',
      adresse: patient.adresse || '',
      numero_dossier: patient.numero_dossier || '',
      lieu_naissance: patient.lieu_naissance || '',
      nationalite: patient.nationalite || 'français',
      profession: patient.profession || '',
      situation_familiale: patient.situation_familiale || '',
      numero_ipm: patient.numero_ipm || '',
      groupe_sanguin: patient.groupe_sanguin || '',
      medecin_traitant: patient.medecin_traitant || '',
      mutuelle: patient.mutuelle || '',
      numero_mutuelle: patient.numero_mutuelle || '',
      assurance_id: patient.assurance_id || null,
      nom_assurance: patient.nom_assurance || '',
      numero_assurance: patient.numero_assurance || '',
      personne_contact: patient.personne_contact || '',
      telephone_contact: patient.telephone_contact || '',
      lien_contact: patient.lien_contact || '',
      actif: patient.actif !== undefined ? patient.actif : true,
      notes: patient.notes || ''
    });
    setEditingPatientId(patient.id);
    setShowForm(true);
  };

  const handleDeletePatient = async (patient) => {
    if (window.confirm(`Êtes-vous sûr de vouloir archiver le patient ${patient.prenom} ${patient.nom} ?`)) {
      try {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', patient.id);
        
        if (error) throw error;
        
        // Recharger la liste des patients
        fetchPatients();
        unifiedNotificationService.success('Patient supprimé avec succès');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        unifiedNotificationService.error('Erreur lors de la suppression du patient');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const isPhoneField = name === 'telephone' || name === 'telephone_contact';
    setFormData(prev => ({
      ...prev,
      [name]: isPhoneField ? formatTelephoneSN(value) : value
    }));
  };

  const handleSubmitForm = async (e, options = { showPostCreateMenu: true }) => {
    if (e?.preventDefault) e.preventDefault();

    // Validation de l'âge minimum
    if (formData.date_naissance) {
      const birthDate = new Date(formData.date_naissance);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

      if (birthDate > today) {
        unifiedNotificationService.error('La date de naissance ne peut pas être dans le futur');
        return;
      }
      if (birthDate > oneYearAgo) {
        unifiedNotificationService.error('Le patient doit être âgé d\'au moins 1 an');
        return;
      }
    }

    if (!isValidTelephoneSN(formData.telephone)) {
      unifiedNotificationService.error('Le téléphone doit être au format 77 777 77 77');
      return;
    }
    if (formData.telephone_contact && !isValidTelephoneSN(formData.telephone_contact)) {
      unifiedNotificationService.error('Le téléphone de contact doit être au format 77 777 77 77');
      return;
    }

    // nom_assurance / numero_assurance ne sont pas des colonnes de public.patients
    // (supprimées par la migration 20250109000001) — ne pas les envoyer à Supabase.
    const { nom_assurance, numero_assurance, ...patientPayload } = formData;
    // date_naissance est une colonne "date" : une chaîne vide fait échouer l'insert/update
    // avec 22007 ("invalid input syntax for type date"), il faut envoyer null.
    if (patientPayload.date_naissance === '') {
      patientPayload.date_naissance = null;
    }

    try {
      if (editingPatientId) {
        const { error } = await supabase
          .from('patients')
          .update(patientPayload)
          .eq('id', editingPatientId);

        if (error) throw error;
        unifiedNotificationService.success('Patient modifié avec succès');
        setShowForm(false);
        setEditingPatientId(null);
      } else {
        const { data: userProfile } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('auth_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert([{ ...patientPayload, tenant_id: userProfile?.tenant_id }])
          .select()
          .single();
        
        if (error) throw error;

        setShowForm(false);
        setEditingPatientId(null);
        fetchPatients();

        if (options.showPostCreateMenu) {
          setCreatedPatient(newPatient);
          setShowPostCreateMenu(true);
        } else {
          unifiedNotificationService.success('Patient ajouté avec succès');
        }
        return;
      }
      
      fetchPatients();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      unifiedNotificationService.error(getPatientUniqueConstraintMessage(error) || 'Erreur lors de la sauvegarde du patient');
    }
  };

  const handleClosePostCreateMenu = () => {
    setShowPostCreateMenu(false);
    setCreatedPatient(null);
  };

  const handleAddPatient = async () => {
    // Générer automatiquement le numéro de dossier
    const { generateNumeroDossier } = await import('../services/patientService');
    const numeroDossier = await generateNumeroDossier();
    
    setFormData({
      nom: '',
      prenom: '',
      date_naissance: '',
      sexe: 'M',
      telephone: '',
      email: '',
      adresse: '',
      numero_dossier: numeroDossier,
      lieu_naissance: '',
      nationalite: 'Sénégalais(e)',
      profession: '',
      situation_familiale: '',
      numero_ipm: '',
      groupe_sanguin: '',
      medecin_traitant: '',
      mutuelle: '',
      numero_mutuelle: '',
      assurance_id: null,
      nom_assurance: '',
      numero_assurance: '',
      personne_contact: '',
      telephone_contact: '',
      lien_contact: '',
      actif: true,
      notes: ''
    });
    setEditingPatientId(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPatientId(null);
    setFormData({
      nom: '',
      prenom: '',
      date_naissance: '',
      sexe: 'M',
      telephone: '',
      email: '',
      adresse: '',
      numero_dossier: '',
      lieu_naissance: '',
      nationalite: 'Sénégalais(e)',
      profession: '',
      situation_familiale: '',
      numero_ipm: '',
      groupe_sanguin: '',
      medecin_traitant: '',
      mutuelle: '',
      numero_mutuelle: '',
      assurance_id: null,
      nom_assurance: '',
      numero_assurance: '',
      personne_contact: '',
      telephone_contact: '',
      lien_contact: '',
      actif: true,
      notes: ''
    });
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      sexe: 'all',
      situation_familiale: 'all',
      mutuelle: '',
      medecin_traitant: '',
      ageMin: '',
      ageMax: ''
    });
  };

  const hasActiveFilters = filters.sexe !== 'all' || 
    filters.situation_familiale !== 'all' || 
    filters.mutuelle || 
    filters.medecin_traitant || 
    filters.ageMin || 
    filters.ageMax;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-medical-primary" />
            Gestion des Patients
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez votre base de données patients et leurs informations médicales
          </p>
        </div>
        
        <button 
          onClick={handleAddPatient}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau Patient
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard icon={Users} tone="blue" label="Total Patients" value={patients.length} />

        <KpiCard icon={Heart} tone="green" label="Patients Actifs" value={patients.filter(p => p.actif).length} />

        <KpiCard icon={Calendar} tone="yellow" label="Nouveaux ce mois" value={12} />

        <KpiCard icon={FileText} tone="purple" label="Consultations" value={consultationsCount} />
      </div>

      {/* Modal d'ajout/modification de patient */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between p-2 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPatientId ? 'Modifier le patient' : 'Nouveau patient'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4">
              <form onSubmit={handleSubmitForm}>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Nom *</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      required
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Prénom *</label>
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleInputChange}
                      required
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Date de naissance *</label>
                    <input
                      type="date"
                      name="date_naissance"
                      value={formData.date_naissance}
                      onChange={handleInputChange}
                      required
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Sexe</label>
                    <Dropdown
                      value={formData.sexe}
                      onChange={(value) => handleInputChange({ target: { name: 'sexe', value } })}
                      options={[
                        { value: 'M', label: 'M' },
                        { value: 'F', label: 'F' },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Téléphone *</label>
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleInputChange}
                      required
                      maxLength={11}
                      placeholder={TELEPHONE_PLACEHOLDER}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Groupe sanguin</label>
                    <Dropdown
                      value={formData.groupe_sanguin}
                      onChange={(value) => handleInputChange({ target: { name: 'groupe_sanguin', value } })}
                      options={[
                        { value: '', label: '-' },
                        { value: 'A+', label: 'A+' },
                        { value: 'A-', label: 'A-' },
                        { value: 'B+', label: 'B+' },
                        { value: 'B-', label: 'B-' },
                        { value: 'AB+', label: 'AB+' },
                        { value: 'AB-', label: 'AB-' },
                        { value: 'O+', label: 'O+' },
                        { value: 'O-', label: 'O-' },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Numéro de dossier</label>
                    <input
                      type="text"
                      name="numero_dossier"
                      value={formData.numero_dossier}
                      readOnly
                      disabled
                      className="input-field text-xs py-1.5 bg-gray-100 text-gray-600 cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Nationalité</label>
                    <input
                      type="text"
                      name="nationalite"
                      value={formData.nationalite}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Lieu naissance</label>
                    <input
                      type="text"
                      name="lieu_naissance"
                      value={formData.lieu_naissance}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Profession</label>
                    <input
                      type="text"
                      name="profession"
                      value={formData.profession}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Situation familiale</label>
                    <Dropdown
                      value={formData.situation_familiale}
                      onChange={(value) => handleInputChange({ target: { name: 'situation_familiale', value } })}
                      options={[
                        { value: '', label: '-' },
                        { value: 'celibataire', label: 'Célibataire' },
                        { value: 'marie', label: 'Marié(e)' },
                        { value: 'divorce', label: 'Divorcé(e)' },
                        { value: 'veuf', label: 'Veuf/Veuve' },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Numéro IPM/CSS</label>
                    <input
                      type="text"
                      name="numero_ipm"
                      value={formData.numero_ipm}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Mutuelle</label>
                    <input
                      type="text"
                      name="mutuelle"
                      value={formData.mutuelle}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Numéro mutuelle</label>
                    <input
                      type="text"
                      name="numero_mutuelle"
                      value={formData.numero_mutuelle}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Assurance</label>
                    <Dropdown
                      value={formData.assurance_id || ''}
                      onChange={(value) => handleInputChange({ target: { name: 'assurance_id', value } })}
                      disabled={loadingAssurances}
                      options={[
                        { value: '', label: loadingAssurances ? 'Chargement...' : 'Aucune assurance' },
                        ...(loadingAssurances ? [] : assurances.map(assurance => ({
                          value: assurance.id,
                          label: `${assurance.nom} ${assurance.taux_remboursement ? `(${assurance.taux_remboursement}%)` : ''}`,
                        }))),
                      ]}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Numéro Assurance</label>
                    <input
                      type="text"
                      name="numero_assurance"
                      value={formData.numero_assurance}
                      onChange={handleInputChange}
                      disabled={!formData.assurance_id}
                      className="input-field text-xs py-1.5 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      placeholder={formData.assurance_id ? 'Numéro de police' : 'Sélectionner une assurance'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Médecin traitant</label>
                    <input
                      type="text"
                      name="medecin_traitant"
                      value={formData.medecin_traitant}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Personne à contacter</label>
                    <input
                      type="text"
                      name="personne_contact"
                      value={formData.personne_contact}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Téléphone contact</label>
                    <input
                      type="tel"
                      name="telephone_contact"
                      value={formData.telephone_contact}
                      onChange={handleInputChange}
                      maxLength={11}
                      placeholder={TELEPHONE_PLACEHOLDER}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Lien avec la personne de contact</label>
                    <input
                      type="text"
                      name="lien_contact"
                      value={formData.lien_contact}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Adresse</label>
                    <input
                      type="text"
                      name="adresse"
                      value={formData.adresse}
                      onChange={handleInputChange}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="1"
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div className="flex items-center pt-4">
                    <input
                      type="checkbox"
                      name="actif"
                      checked={formData.actif}
                      onChange={(e) => setFormData(prev => ({ ...prev, actif: e.target.checked }))}
                      className="mr-1 rounded text-xs"
                    />
                    <label className="text-xs text-gray-700">Actif</label>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="btn btn-secondary text-xs py-1.5 px-3"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary text-xs py-1.5 px-3"
                  >
                    {editingPatientId ? 'Modifier' : 'Enregistrer'}
                  </button>
                  {!editingPatientId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSubmitForm({ preventDefault: () => {} }, { showPostCreateMenu: false });
                        unifiedNotificationService.success('Patient ajouté avec succès');
                        handleAddPatient();
                      }}
                      className="btn btn-success text-xs py-1.5 px-3"
                    >
                      + Autre
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 relative z-10 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {isDoctor && (
            <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none flex-shrink-0">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                {showOnlyMine ? 'Mes patients' : 'Tous les patients'}
              </span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                />
                <span className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-medical-primary"></span>
              </span>
            </label>
          )}

         <div className="mx-2 flex items-center">
         <Dropdown
            value={filterStatus}
            onChange={(value) => setFilterStatus(value)}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'actif', label: 'Actifs' },
              { value: 'inactif', label: 'Inactifs' },
            ]}
            size="sm"
          />
         </div>
          
          <button 
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`btn btn-secondary flex items-center gap-2 relative ${hasActiveFilters ? 'bg-blue-100 border-blue-300' : ''}`}
          >
            <Filter className="w-5 h-5" />
            Filtres
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </div>
        
        {/* Panneau de filtres avancés */}
        {showFiltersPanel && (
          <div className="mt-4 pt-4 border-t border-gray-200 relative z-20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filtres avancés</h3>
              <button
                onClick={handleResetFilters}
                className="text-sm text-medical-primary hover:text-medical-secondary"
              >
                Réinitialiser
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Filtre par sexe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
                <Dropdown
                  value={filters.sexe}
                  onChange={(value) => handleFilterChange('sexe', value)}
                  options={[
                    { value: 'all', label: 'Tous' },
                    { value: 'M', label: 'Masculin' },
                    { value: 'F', label: 'Féminin' },
                  ]}
                  size="sm"
                />
              </div>
              
              {/* Filtre par situation familiale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situation familiale</label>
                <Dropdown
                  value={filters.situation_familiale}
                  onChange={(value) => handleFilterChange('situation_familiale', value)}
                  options={[
                    { value: 'all', label: 'Toutes' },
                    { value: 'celibataire', label: 'Célibataire' },
                    { value: 'marie', label: 'Marié(e)' },
                    { value: 'divorce', label: 'Divorcé(e)' },
                    { value: 'veuf', label: 'Veuf/Veuve' },
                  ]}
                  size="sm"
                />
              </div>
              
              {/* Filtre par mutuelle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mutuelle</label>
                <input
                  type="text"
                  placeholder="Nom de la mutuelle..."
                  value={filters.mutuelle}
                  onChange={(e) => handleFilterChange('mutuelle', e.target.value)}
                  className="input-field"
                />
              </div>
              
              {/* Filtre par médecin traitant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médecin traitant</label>
                <input
                  type="text"
                  placeholder="Nom du médecin..."
                  value={filters.medecin_traitant}
                  onChange={(e) => handleFilterChange('medecin_traitant', e.target.value)}
                  className="input-field"
                />
              </div>
              
              {/* Filtre par âge minimum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Âge minimum</label>
                <input
                  type="number"
                  placeholder="Ex: 18"
                  value={filters.ageMin}
                  onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
              
              {/* Filtre par âge maximum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Âge maximum</label>
                <input
                  type="number"
                  placeholder="Ex: 65"
                  value={filters.ageMax}
                  onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Liste des patients */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 relative z-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Patient</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Dossier</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Statut</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.map((patient) => {
                const isMine = isDoctor && !showOnlyMine && myPatientIds.has(patient.id);
                return (
                <tr
                  key={patient.id}
                  className={`border-b border-gray-100 ${isMine ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-medical-primary to-medical-secondary rounded-full flex items-center justify-center text-white font-semibold">
                        {patient.prenom[0]}{patient.nom[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {patient.prenom} {patient.nom}
                          </p>
                          {isMine && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700"
                              title="Vous avez déjà consulté ce patient"
                            >
                              <User className="w-3 h-3" />
                              Mon patient
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {patient.sexe === 'M' ? 'Masculin' : 'Féminin'} • {calculateAge(patient.date_naissance)} ans
                        </p>
                        {patient.profession && (
                          <p className="text-sm text-gray-500">{patient.profession}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {patient.telephone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{patient.telephone}</span>
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{patient.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div>
                      {patient.numero_dossier && (
                        <div className="text-sm font-medium text-blue-600">{patient.numero_dossier}</div>
                      )}
                      {patient.numero_ipm && (
                        <div className="text-sm text-gray-500">SS: {patient.numero_ipm}</div>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-4">
                    {getStatusBadge(patient.actif)}
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleViewPatient(patient)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Voir les détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditPatient(patient)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Mettre à jour"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!isSecretary && (
                        <button 
                          onClick={() => handleDeletePatient(patient)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Archiver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredPatients.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun patient trouvé</p>
          </div>
        )}

        {filteredPatients.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Affichage de {startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredPatients.length)} sur {filteredPatients.length} patients
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-medical-primary text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <PatientPostCreateMenu
        patient={createdPatient}
        isOpen={showPostCreateMenu}
        onClose={handleClosePostCreateMenu}
      />
    </div>
  );
};

export default PatientsPage;
