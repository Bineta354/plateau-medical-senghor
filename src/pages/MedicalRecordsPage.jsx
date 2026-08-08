import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Dropdown from '../components/common/Dropdown';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  Eye,
  Calendar,
  User,
  Stethoscope,
  Pill,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  File,
  FolderOpen,
  X,
  Save,
  Upload,
  UserSearch,
  RefreshCw,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getConsultationMotif } from '../utils/consultationUtils';
import { useAuth } from '../contexts/AuthContext';
import TransfertDossierModal from '../components/doctor/TransfertDossierModal';

const MedicalRecordsPage = () => {
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // État pour gérer l'étape (1: choix patient, 2: affichage dossiers)
  const [currentStep, setCurrentStep] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // États pour les données réelles
  const [allPatients, setAllPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  
  // États pour les modals
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [showTransfertDossierModal, setShowTransfertDossierModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // État pour le formulaire
  const [newRecord, setNewRecord] = useState({
    type: 'consultation',
    titre: '',
    description: '',
    notes: '',
    documents: []
  });

  // Charger les patients au démarrage
  useEffect(() => {
    if (userProfile?.id) {
      fetchPatients();
    }
  }, [userProfile?.id]);

  // Gérer le paramètre URL patient_id
  useEffect(() => {
    const patientIdParam = searchParams.get('patient_id');
    if (patientIdParam && allPatients.length > 0) {
      const patient = allPatients.find(p => p.id === parseInt(patientIdParam));
      if (patient) {
        handleSelectPatient(patient);
      }
    }
  }, [searchParams, allPatients]);

  // Charger les dossiers médicaux quand un patient est sélectionné
  useEffect(() => {
    if (selectedPatient && currentStep === 2) {
      fetchMedicalRecords();
    }
  }, [selectedPatient, currentStep]);

  // Récupérer tous les patients du médecin
  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      
      // Vérifier d'abord que le médecin est actif
      const { data: doctorData, error: doctorError } = await supabase
        .from('users')
        .select('id, actif')
        .eq('id', userProfile.id)
        .single();

      if (doctorError || !doctorData || doctorData.actif === false) {
        console.warn('Médecin inactif ou introuvable, aucun patient chargé');
        setAllPatients([]);
        return;
      }

      // Récupérer les consultations du médecin avec les infos patients
      const { data: consultationsData, error: consultError } = await supabase
        .from('consultations')
        .select(`
          *,
          patients (
            id,
            nom,
            prenom,
            date_naissance,
            sexe,
            telephone,
            email,
            numero_dossier,
            adresse
          )
        `)
        .eq('medecin_id', userProfile.id)
        .order('date_consultation', { ascending: false });

      if (consultError) throw consultError;

      // Extraire les patients uniques
      const uniquePatients = [];
      const patientIds = new Set();
      
      consultationsData?.forEach(consultation => {
        if (consultation.patients && !patientIds.has(consultation.patients.id)) {
          patientIds.add(consultation.patients.id);
          uniquePatients.push(consultation.patients);
        }
      });

      setAllPatients(uniquePatients);

    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
      alert('Erreur lors du chargement des patients');
    } finally {
      setIsLoading(false);
    }
  };

  // Récupérer les dossiers médicaux du patient sélectionné
  const fetchMedicalRecords = async () => {
    if (!selectedPatient) return;

    try {
      setIsLoading(true);
      
      // Récupérer les consultations du patient avec ce médecin
      const { data: consultationsData, error: consultError } = await supabase
        .from('consultations')
        .select('*')
        .eq('medecin_id', userProfile.id)
        .eq('patient_id', selectedPatient.id)
        .order('date_consultation', { ascending: false });

      if (consultError) throw consultError;

      setConsultations(consultationsData || []);

      // Construire les dossiers médicaux à partir des consultations
      const records = consultationsData?.map(consultation => ({
        id: consultation.id,
        type: 'consultation',
        date: consultation.date_consultation || consultation.created_at,
        medecin: `Dr. ${userProfile.prenom} ${userProfile.nom}`,
        titre: getConsultationMotif(consultation) || 'Consultation',
        description: getConsultationMotif(consultation) || 'Consultation médicale',
        documents: [],
        statut: consultation.statut || 'terminee',
        notes: consultation.notes_generales || '',
        patient_id: consultation.patient_id,
        patient: selectedPatient
      })) || [];

      setMedicalRecords(records);

    } catch (error) {
      console.error('Erreur lors du chargement des dossiers médicaux:', error);
      alert('Erreur lors du chargement des dossiers médicaux');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour sélectionner un patient et passer à l'étape 2
  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setCurrentStep(2);
    setSearchParams({ patient_id: patient.id.toString() });
  };

  // Fonction pour revenir à l'étape 1 (choix du patient)
  const handleBackToPatients = () => {
    setSelectedPatient(null);
    setCurrentStep(1);
    setMedicalRecords([]);
    setSearchParams({});
  };

  const filteredRecords = medicalRecords.filter(record => {
    const matchesSearch = record.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.medecin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || record.type === filterType;
    const matchesPatient = !selectedPatient || record.patient_id === selectedPatient.id;
    return matchesSearch && matchesFilter && matchesPatient;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'consultation': return <Stethoscope className="w-4 h-4" />;
      case 'examen': return <Activity className="w-4 h-4" />;
      case 'prescription': return <Pill className="w-4 h-4" />;
      case 'hospitalisation': return <AlertTriangle className="w-4 h-4" />;
      case 'vaccination': return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'consultation': return 'text-blue-600 bg-blue-100';
      case 'examen': return 'text-green-600 bg-green-100';
      case 'prescription': return 'text-purple-600 bg-purple-100';
      case 'hospitalisation': return 'text-red-600 bg-red-100';
      case 'vaccination': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (statut) => {
    if (statut === 'actif' || statut === 'en_cours') {
      return 'text-blue-600 bg-blue-100';
    } else if (statut === 'terminee' || statut === 'terminé') {
      return 'text-green-600 bg-green-100';
    } else if (statut === 'annulee') {
      return 'text-red-600 bg-red-100';
    }
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusLabel = (statut) => {
    if (statut === 'en_cours') return 'En cours';
    if (statut === 'terminee') return 'Terminé';
    if (statut === 'annulee') return 'Annulé';
    if (statut === 'actif') return 'Actif';
    return 'Terminé';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Fonctions de gestion
  const handleNewRecord = () => {
    if (!selectedPatient) {
      alert('Veuillez d\'abord sélectionner un patient');
      return;
    }
    setShowNewRecordModal(true);
  };

  const handleViewConsultation = (record) => {
    // Naviguer vers la page de consultation
    navigate(`/consultation/${record.id}`);
  };

  const handleRefresh = () => {
    if (currentStep === 1) {
      fetchPatients();
    } else if (selectedPatient) {
      fetchMedicalRecords();
    }
  };

  const saveNewRecord = async () => {
    console.log('🔵 [MedicalRecords] Création dossier:', newRecord);
    
    if (!selectedPatient) {
      console.error('❌ [MedicalRecords] Aucun patient sélectionné');
      alert('Veuillez sélectionner un patient');
      return;
    }
    
    if (!userProfile?.id) {
      console.error('❌ [MedicalRecords] Médecin non identifié');
      alert('Erreur: Médecin non identifié');
      return;
    }
    
    if (!newRecord.titre || !newRecord.description) {
      alert('Veuillez remplir le titre et la description');
      return;
    }
    
    try {
      console.log('🔵 [MedicalRecords] Création de la consultation...');
      
      // Créer une consultation pour ce dossier
      const consultationData = {
        patient_id: selectedPatient.id,
        medecin_id: userProfile.id,
        date_consultation: new Date().toISOString(),
        motif_consultation: newRecord.titre,
        statut: 'terminee'
      };
      
      // Ajouter notes_generales seulement si la colonne existe
      try {
        consultationData.notes_generales = `TYPE: ${newRecord.type}\n\nDESCRIPTION:\n${newRecord.description}\n\nNOTES:\n${newRecord.notes || 'Aucune'}`;
      } catch (e) {
        console.warn('⚠️ Colonne notes_generales non disponible');
      }
      
      const { data: consultation, error: consultError } = await supabase
        .from('consultations')
        .insert(consultationData)
        .select()
        .single();
      
      if (consultError) {
        console.error('❌ [MedicalRecords] Erreur création:', consultError);
        throw consultError;
      }
      
      console.log('✅ [MedicalRecords] Dossier créé:', consultation);
      
      // Rafraîchir la liste des dossiers
      await fetchMedicalRecords();
      
      setSuccessMessage('Dossier médical créé avec succès !');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowNewRecordModal(false);
      setNewRecord({
        type: 'consultation',
        titre: '',
        description: '',
        notes: '',
        documents: []
      });
      
    } catch (error) {
      console.error('❌ [MedicalRecords] Erreur lors de la création:', error);
      alert(`Erreur lors de la création: ${error.message}`);
    }
  };

  // Filtrer les patients selon la recherche
  const filteredPatients = allPatients.filter(patient => {
    if (!patientSearchTerm) return true;
    const search = patientSearchTerm.toLowerCase();
    return (
      patient.nom?.toLowerCase().includes(search) ||
      patient.prenom?.toLowerCase().includes(search) ||
      patient.numero_dossier?.toLowerCase().includes(search) ||
      patient.telephone?.includes(search)
    );
  });

  // Calculer les statistiques réelles
  const calculateStats = () => {
    if (!selectedPatient) return { total: 0, derniereVisite: null };
    const patientRecords = medicalRecords.filter(r => r.patient_id === selectedPatient.id);
    const lastRecord = patientRecords.length > 0 
      ? patientRecords.reduce((latest, record) => {
          return new Date(record.date) > new Date(latest.date) ? record : latest;
        }, patientRecords[0])
      : null;
    
    return {
      total: patientRecords.length,
      derniereVisite: lastRecord ? formatDate(lastRecord.date) : null
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6 p-6">
      {/* Message de succès - Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out">
          <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">✅ {successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 1 : Choix du patient */}
      {currentStep === 1 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dossiers Médicaux</h1>
              <p className="text-gray-600">Sélectionnez un patient pour consulter son dossier médical</p>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                placeholder="Rechercher un patient par nom, prénom, numéro de dossier ou téléphone..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Liste des patients */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Liste des patients</h2>
              <p className="text-sm text-gray-600">{filteredPatients.length} patient(s) trouvé(s)</p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-medical-primary animate-spin" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {patientSearchTerm ? 'Aucun patient ne correspond à votre recherche' : 'Aucun patient trouvé'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-medical-primary bg-opacity-10 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-medical-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {patient.prenom} {patient.nom}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                            {patient.numero_dossier && (
                              <span>Dossier: {patient.numero_dossier}</span>
                            )}
                            {patient.telephone && (
                              <span className="flex items-center">
                                <Phone className="w-4 h-4 mr-1" />
                                {patient.telephone}
                              </span>
                            )}
                            {patient.date_naissance && (
                              <span>{calculateAge(patient.date_naissance)} ans</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <button className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors">
                          Voir le dossier
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ÉTAPE 2 : Affichage du dossier médical */}
      {currentStep === 2 && selectedPatient && (
        <>
          {/* En-tête avec bouton retour */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToPatients}
                className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la liste
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dossier Médical</h1>
                <p className="text-gray-600">
                  {selectedPatient.prenom} {selectedPatient.nom}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowTransfertDossierModal(true)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Transférer le dossier
              </button>
              <button 
                onClick={handleNewRecord}
                className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau dossier
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Informations patient */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Informations patient
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Nom complet :</span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {selectedPatient.prenom} {selectedPatient.nom}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Date de naissance :</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDate(selectedPatient.date_naissance)} ({calculateAge(selectedPatient.date_naissance)} ans)
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Sexe :</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedPatient.sexe === 'M' ? 'Masculin' : 'Féminin'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">N° Dossier :</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedPatient.numero_dossier || 'Non renseigné'}</p>
                  </div>
                  {selectedPatient.telephone && (
                    <div>
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <Phone className="w-4 h-4 mr-1" /> Téléphone :
                      </span>
                      <p className="text-sm text-gray-900 mt-1">{selectedPatient.telephone}</p>
                    </div>
                  )}
                  {selectedPatient.email && (
                    <div>
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <Mail className="w-4 h-4 mr-1" /> Email :
                      </span>
                      <p className="text-sm text-gray-900 mt-1">{selectedPatient.email}</p>
                    </div>
                  )}
                  {selectedPatient.adresse && (
                    <div>
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <MapPin className="w-4 h-4 mr-1" /> Adresse :
                      </span>
                      <p className="text-sm text-gray-900 mt-1">{selectedPatient.adresse}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistiques du dossier */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Statistiques
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total consultations :</span>
                    <span className="text-sm font-medium text-gray-900">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dernière visite :</span>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.derniereVisite || 'Aucune'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des dossiers */}
            <div className="lg:col-span-3">
              {/* Barre de recherche et filtres */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Barre de recherche */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher par titre, description ou médecin..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    />
                  </div>
                  
                  {/* Filtre par type */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                    <Dropdown
                      value={filterType}
                      onChange={(value) => setFilterType(value)}
                      options={[
                        { value: 'all', label: 'Tous les types' },
                        { value: 'consultation', label: 'Consultation' },
                        { value: 'examen', label: 'Examen' },
                        { value: 'prescription', label: 'Prescription' },
                        { value: 'hospitalisation', label: 'Hospitalisation' },
                        { value: 'vaccination', label: 'Vaccination' },
                      ]}
                      size="sm"
                      className="pl-9 min-w-[180px]"
                    />
                  </div>

                  {/* Bouton rafraîchir */}
                  <button
                    onClick={handleRefresh}
                    className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Rafraîchir"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Liste des dossiers médicaux */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Historique médical</h2>
              <p className="text-sm text-gray-600">{filteredRecords.length} dossier(s) trouvé(s)</p>
            </div>
            
            <div className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <div 
                  key={record.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewConsultation(record)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`p-2 rounded-full ${getTypeColor(record.type)}`}>
                          {getTypeIcon(record.type)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{record.titre}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(record.date)}
                            </span>
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {record.medecin}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.statut)}`}>
                              {getStatusLabel(record.statut)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{record.description}</p>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <File className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Documents :</span>
                          <div className="flex space-x-1">
                            {record.documents.map((doc, index) => (
                              <span key={`${record.id}-doc-${index}`} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewConsultation(record);
                        }}
                        className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                        title="Voir la consultation"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

{/* Modal Nouveau Dossier */}
      {showNewRecordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Nouveau dossier médical</h3>
                <button
                  onClick={() => setShowNewRecordModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type de dossier</label>
                  <Dropdown
                    value={newRecord.type}
                    onChange={(value) => setNewRecord(prev => ({ ...prev, type: value }))}
                    options={[
                      { value: 'consultation', label: 'Consultation' },
                      { value: 'examen', label: 'Examen' },
                      { value: 'prescription', label: 'Prescription' },
                      { value: 'hospitalisation', label: 'Hospitalisation' },
                      { value: 'vaccination', label: 'Vaccination' },
                    ]}
                    size="md"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Titre</label>
                  <input
                    type="text"
                    value={newRecord.titre}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, titre: e.target.value }))}
                    placeholder="Ex: Consultation de routine"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newRecord.description}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description détaillée du dossier médical..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes médicales</label>
                <textarea
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes et observations médicales..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowNewRecordModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveNewRecord}
                  className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Créer le dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfert de dossier */}
      {selectedPatient && (
        <TransfertDossierModal
          isOpen={showTransfertDossierModal}
          onClose={() => setShowTransfertDossierModal(false)}
          patient={selectedPatient}
          consultationId={null}
          onSuccess={(transfert) => {
            setSuccessMessage('Transfert de dossier créé avec succès !');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            setShowTransfertDossierModal(false);
          }}
        />
      )}
    </div>
  );
};

export default MedicalRecordsPage;
