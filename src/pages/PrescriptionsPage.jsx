import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Dropdown from '../components/common/Dropdown';
import { 
  Pill, 
  Search, 
  Eye, 
  Calendar,
  User,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PrescriptionsPage = () => {
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // État pour gérer l'étape (1: choix patient, 2: affichage ordonnances)
  const [currentStep, setCurrentStep] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // États pour les données réelles
  const [allPatients, setAllPatients] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

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

  // Charger les ordonnances quand un patient est sélectionné
  useEffect(() => {
    if (selectedPatient && currentStep === 2) {
      fetchPrescriptions();
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

  // Récupérer les ordonnances du patient sélectionné
  const fetchPrescriptions = async () => {
    if (!selectedPatient) return;

    try {
      setIsLoading(true);
      
      // Récupérer les ordonnances du patient avec ce médecin
      const { data: ordonnancesData, error: ordonnancesError } = await supabase
        .from('ordonnances')
        .select(`
          *,
          consultations!inner (
            id,
            medecin_id,
            patient_id
          ),
          lignes_ordonnance (
            *,
            medicaments (
              nom
            )
          )
        `)
        .eq('consultations.medecin_id', userProfile.id)
        .eq('consultations.patient_id', selectedPatient.id)
        .order('created_at', { ascending: false });

      if (ordonnancesError) throw ordonnancesError;

      // Construire les prescriptions
      const formattedPrescriptions = ordonnancesData?.map(ordonnance => ({
        id: ordonnance.id,
        consultation_id: ordonnance.consultations?.id,
        datePrescription: ordonnance.date_prescription || ordonnance.created_at,
        patient: `${selectedPatient.prenom} ${selectedPatient.nom}`,
        patient_id: selectedPatient.id,
        medecin: `Dr. ${userProfile.prenom} ${userProfile.nom}`,
        medicaments: ordonnance.lignes_ordonnance?.map(ligne => ({
          nom: ligne.medicaments?.nom || 'Médicament inconnu',
          dosage: ligne.posologie || '',
          posologie: ligne.posologie || '',
          quantite: `${ligne.quantite || 0} unités`,
          instructions: ligne.instructions_particulieres || ''
        })) || [],
        motif: ordonnance.instructions_generales || 'Non renseigné',
        statut: ordonnance.statut || 'actif',
        dateFin: null,
        renouvellement: false,
        notes: ordonnance.instructions_generales || ''
      })) || [];

      setPrescriptions(formattedPrescriptions);

    } catch (error) {
      console.error('Erreur lors du chargement des ordonnances:', error);
      alert('Erreur lors du chargement des ordonnances');
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
    setPrescriptions([]);
    setSearchParams({});
  };

  // Fonction pour naviguer vers la consultation
  const handleViewConsultation = (prescription) => {
    if (prescription.consultation_id) {
      navigate(`/consultation/${prescription.consultation_id}`);
    }
  };

  const handleRefresh = () => {
    if (currentStep === 1) {
      fetchPatients();
    } else if (selectedPatient) {
      fetchPrescriptions();
    }
  };

  // Filtrer les ordonnances selon la recherche
  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = prescription.motif.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prescription.medecin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || prescription.statut === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

  const getStatusColor = (statut) => {
    return statut === 'actif' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (statut) => {
    return statut === 'actif' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />;
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

  return (
    <div className="space-y-6 p-6">
      {/* ÉTAPE 1 : Choix du patient */}
      {currentStep === 1 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ordonnances</h1>
              <p className="text-gray-600">Sélectionnez un patient pour consulter ses ordonnances</p>
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
                          Voir les ordonnances
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

      {/* ÉTAPE 2 : Affichage des ordonnances */}
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
                <h1 className="text-3xl font-bold text-gray-900">Ordonnances</h1>
                <p className="text-gray-600">
                  {selectedPatient.prenom} {selectedPatient.nom}
                </p>
              </div>
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

              {/* Statistiques */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Pill className="w-5 h-5 mr-2" />
                  Statistiques
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total ordonnances :</span>
                    <span className="text-sm font-medium text-gray-900">{filteredPrescriptions.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des ordonnances */}
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
                      placeholder="Rechercher par motif ou médecin..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    />
                  </div>
                  
                  {/* Filtre par statut */}
                  <div className="relative">
                    <Dropdown
                      value={filterStatus}
                      onChange={(value) => setFilterStatus(value)}
                      options={[
                        { value: 'all', label: 'Tous les statuts' },
                        { value: 'actif', label: 'Actives' },
                        { value: 'termine', label: 'Terminées' },
                      ]}
                      size="sm"
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

              {/* Liste des ordonnances */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Historique des ordonnances</h2>
                  <p className="text-sm text-gray-600">{filteredPrescriptions.length} ordonnance(s) trouvée(s)</p>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-medical-primary animate-spin" />
                    </div>
                  ) : filteredPrescriptions.length === 0 ? (
                    <div className="text-center py-12">
                      <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        {searchTerm ? 'Aucune ordonnance ne correspond à votre recherche' : 'Aucune ordonnance trouvée'}
                      </p>
                    </div>
                  ) : (
                    filteredPrescriptions.map((prescription) => (
                      <div 
                        key={prescription.id} 
                        className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleViewConsultation(prescription)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className={`p-2 rounded-full ${getStatusColor(prescription.statut)}`}>
                                {getStatusIcon(prescription.statut)}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{prescription.motif}</h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-1" />
                                    {formatDate(prescription.datePrescription)}
                                  </span>
                                  <span className="flex items-center">
                                    <User className="w-4 h-4 mr-1" />
                                    {prescription.medecin}
                                  </span>
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(prescription.statut)}`}>
                                    {prescription.statut === 'actif' ? 'Active' : 'Terminée'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {prescription.medicaments && prescription.medicaments.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2">Médicaments :</p>
                                <div className="space-y-1">
                                  {prescription.medicaments.slice(0, 3).map((med, index) => (
                                    <div key={`${prescription.id}-med-${index}`} className="flex items-center space-x-2">
                                      <Pill className="w-3 h-3 text-gray-400" />
                                      <span className="text-sm text-gray-700">
                                        {med.nom} {med.dosage && `- ${med.dosage}`} {med.posologie && `(${med.posologie})`}
                                      </span>
                                    </div>
                                  ))}
                                  {prescription.medicaments.length > 3 && (
                                    <span className="text-xs text-gray-500">+ {prescription.medicaments.length - 3} autre(s)</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewConsultation(prescription);
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
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrescriptionsPage;
