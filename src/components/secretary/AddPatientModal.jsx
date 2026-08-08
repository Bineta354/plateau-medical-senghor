import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../contexts/AlertContext';
import { generateNumeroDossier, validateBirthDate } from '../../services/patientService';
import { validatePatientForm, getDateNaissanceError, normalizePatientPayload } from '../../schemas/patientSchema';
import SearchableSelect from '../common/SearchableSelect';
import CreateRdvModal from '../doctor/CreateRdvModal';
import PatientAntecedentsModal from './PatientAntecedentsModal';
import {
  X,
  User,
  Phone,
  Calendar,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle,
  ClipboardList
} from 'lucide-react';

const AddPatientModal = ({ doctors, onClose, onPatientAdded }) => {
  const { showError, showWarning } = useAlert();
  const [step, setStep] = useState(1); // 1: Sélection, 2: File d'attente, 3: Menu Succès
  const [queueReturnStep, setQueueReturnStep] = useState(1);
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [showAntecedentsModal, setShowAntecedentsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [priority, setPriority] = useState('normale');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [showAntecedentsModal, setShowAntecedentsModal] = useState(false);
  
  // États pour la gestion des assurances
  const [assurances, setAssurances] = useState([]);
  const [typeAssurance, setTypeAssurance] = useState('aucune'); // 'aucune', 'assurance'
  const [selectedAssuranceId, setSelectedAssuranceId] = useState('');
  const [showNewAssuranceForm, setShowNewAssuranceForm] = useState(false);
  const [newAssurance, setNewAssurance] = useState({
    nom: '',
    type_assurance: 'mutuelle',
    taux_remboursement: 0,
    description: ''
  });
  
  const [newPatient, setNewPatient] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    telephone: '',
    email: '',
    adresse: '',
    assurance_id: null,
    numero_dossier: '',
    sexe: 'M',
    lieu_naissance: '',
    nationalite: 'sénégalais(e)',
    profession: '',
    situation_familiale: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    medecin_traitant: '',
    numero_secu: '',
    actif: true,
    notes: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (step === 1) {
      fetchPatients();
    }
  }, [searchTerm]);

  useEffect(() => {
    if (showNewPatientForm) {
      fetchAssurances();
      // Générer automatiquement le numéro de dossier
      generateNumeroDossier().then(numero => {
        setNewPatient(prev => ({ ...prev, numero_dossier: numero }));
      });
    }
  }, [showNewPatientForm]);

  const fetchAssurances = async () => {
    try {
      const { data, error } = await supabase
        .from('assurances')
        .select('*')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (error) throw error;
      
      // Ajouter l'option "Autre" à la fin de la liste
      const assurancesWithOther = [
        ...(data || []),
        { id: 'autre', nom: '➕ Autre (Créer une nouvelle assurance)', label: '➕ Autre (Créer une nouvelle assurance)' }
      ];
      
      setAssurances(assurancesWithOther);
    } catch (error) {
      console.error('Erreur lors de la récupération des assurances:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });

      if (searchTerm) {
        query = query.or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,numero_dossier.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors de la recherche des patients:', error);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setQueueReturnStep(1);
    setStep(2);
  };

  const goToQueueStep = (fromStep = 1) => {
    setQueueReturnStep(fromStep);
    setStep(2);
  };

  const handleAddToQueue = async () => {
    if (!selectedPatient || !selectedDoctor) {
      showWarning('Veuillez sélectionner un patient et un médecin');
      return;
    }

    setLoading(true);
    try {
      // Récupérer la position actuelle dans la file d'attente
      const { data: currentQueue } = await supabase
        .from('waiting_queue')
        .select('order_position')
        .eq('medecin_id', selectedDoctor)
        .order('order_position', { ascending: false })
        .limit(1);

      const nextPosition = currentQueue && currentQueue.length > 0 ? currentQueue[0].order_position + 1 : 1;

      // Ajouter le patient à la file d'attente
      const { error } = await supabase
        .from('waiting_queue')
        .insert([{
          patient_id: selectedPatient.id,
          medecin_id: selectedDoctor,
          status: 'waiting',
          priority: priority,
          arrived_at: new Date().toISOString(),
          order_position: nextPosition,
          motif_consultation: notes
        }]);

      if (error) throw error;

      // Ajouter le patient et rafraîchir les données
      onPatientAdded();
      // Ne pas fermer automatiquement la modal - laisser l'utilisateur décider
      // onClose();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du patient:', error);
      showError('Erreur lors de l\'ajout du patient à la file d\'attente');
    } finally {
      setLoading(false);
    }
  };

  const validateNewPatient = () => {
    const { errors } = validatePatientForm(newPatient);
    return errors;
  };

  const handleCreateNewPatient = async () => {
    // Valider le formulaire
    const validationErrors = validateNewPatient();
    if (Object.keys(validationErrors).length > 0) {
      showWarning(Object.values(validationErrors).join(', '));
      return;
    }

    // Validation backend de la date de naissance
    const birthDateValidation = validateBirthDate(newPatient.date_naissance);
    if (!birthDateValidation.valid) {
      showWarning(birthDateValidation.error);
      return;
    }

    setLoading(true);
    try {
      let assuranceIdToUse = null;

      // Si une assurance est sélectionnée
      if (typeAssurance === 'assurance') {
        // Si "Autre" est sélectionné, créer d'abord la nouvelle assurance
        if (selectedAssuranceId === 'autre') {
          if (!newAssurance.nom) {
            showWarning('Veuillez renseigner le nom de l\'assurance');
            setLoading(false);
            return;
          }

          const { data: createdAssurance, error: assuranceError } = await supabase
            .from('assurances')
            .insert([{
              nom: newAssurance.nom,
              type_assurance: newAssurance.type_assurance,
              taux_remboursement: newAssurance.taux_remboursement,
              description: newAssurance.description,
              actif: true
            }])
            .select()
            .single();

          if (assuranceError) throw assuranceError;
          assuranceIdToUse = createdAssurance.id;
        } else if (selectedAssuranceId) {
          assuranceIdToUse = selectedAssuranceId;
        }
      }

      // Créer le nouveau patient avec l'assurance_id
      const patientData = {
        ...newPatient,
        assurance_id: assuranceIdToUse
      };
      
      // Ne jamais envoyer numero_dossier dans le payload (généré automatiquement par le trigger)
      delete patientData.numero_dossier;

      const normalizedPatientData = normalizePatientPayload(patientData);

      const { data: createdPatient, error: patientError } = await supabase
        .from('patients')
        .insert([normalizedPatientData])
        .select()
        .single();

      if (patientError) throw patientError;

      setSelectedPatient(createdPatient);
      setShowNewPatientForm(false);
      onPatientAdded();
      setStep(3);
    } catch (error) {
      console.error('Erreur lors de la création du patient:', error);
      showError('Erreur lors de la création du patient: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestFollowUp = async (type) => {
    const now = new Date();
    let suggestedDate = new Date();
    
    if (type === '1_week') suggestedDate.setDate(now.getDate() + 7);
    else if (type === '2_weeks') suggestedDate.setDate(now.getDate() + 14);
    else if (type === '1_month') suggestedDate.setMonth(now.getMonth() + 1);

    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: null, // Pour toutes les secrétaires
          role_destinataire: 'secretary',
          type_notification: 'appointment_request',
          message: `Demande de rendez-vous pour ${selectedPatient.prenom} ${selectedPatient.nom} (${type.replace('_', ' ')})`,
          data: {
            patientId: selectedPatient.id,
            patientName: `${selectedPatient.prenom} ${selectedPatient.nom}`,
            suggestedDate: suggestedDate.toISOString(),
            type: type
          }
        }]);
      if (error) throw error;
      showWarning('Demande de planification envoyée à la secrétaire');
    } catch (error) {
      showError('Erreur lors de l\'envoi de la notification');
    }
  };

  const resetForm = () => {
    setStep(1);
    setQueueReturnStep(1);
    setSelectedPatient(null);
    setSelectedDoctor('');
    setPriority('normale');
    setNotes('');
    setSearchTerm('');
    setShowNewPatientForm(false);
    setTypeAssurance('aucune');
    setSelectedAssuranceId('');
    setShowNewAssuranceForm(false);
    setNewAssurance({
      nom: '',
      type_assurance: 'mutuelle',
      taux_remboursement: 0,
      description: ''
    });
    setNewPatient({
      nom: '',
      prenom: '',
      date_naissance: '',
      telephone: '',
      email: '',
      adresse: '',
      assurance_id: null,
      numero_dossier: '',
      sexe: 'M',
      lieu_naissance: '',
      nationalite: '',
      profession: '',
      situation_familiale: '',
      personne_contact: '',
      telephone_contact: '',
      lien_contact: '',
      medecin_traitant: '',
      numero_secu: '',
      actif: true,
      notes: ''
    });
  };

  const handleAssuranceChange = (value) => {
    setSelectedAssuranceId(value);
    if (value === 'autre') {
      setShowNewAssuranceForm(true);
    } else {
      setShowNewAssuranceForm(false);
    }
  };

  const handleNewPatientChange = (field, value) => {
    setNewPatient(prev => ({ ...prev, [field]: value }));
    
    // Validation en temps réel pour la date de naissance
    if (field === 'date_naissance') {
      validateDateNaissanceRealTime(value);
    } else {
      // Effacer l'erreur quand l'utilisateur commence à taper
      if (fieldErrors[field]) {
        setFieldErrors(prev => ({ ...prev, [field]: '' }));
      }
    }
  };

  const validateDateNaissanceRealTime = (value) => {
    setFieldErrors(prev => ({ ...prev, date_naissance: getDateNaissanceError(value) }));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* En-tête */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 1 ? 'Sélectionner un Patient' : step === 2 ? 'Ajouter à la File d\'Attente' : 'Patient créé avec succès'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Contenu */}
          <div className="p-6">
            {step === 3 ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Dossier créé !</h3>
                <p className="text-gray-600 mb-8">
                  Le patient <strong>{selectedPatient?.prenom} {selectedPatient?.nom}</strong> a été enregistré.
                  Quelle est la prochaine étape ?
                </p>
                
                <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                  <div className="flex flex-col gap-2 mb-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Planification rapide</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleRequestFollowUp('1_week')} className="text-xs py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        +1 Semaine
                      </button>
                      <button onClick={() => handleRequestFollowUp('2_weeks')} className="text-xs py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        +2 Semaines
                      </button>
                      <button onClick={() => handleRequestFollowUp('1_month')} className="text-xs py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        +1 Mois
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => goToQueueStep(3)}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-medical-primary text-white rounded-xl font-semibold hover:bg-medical-primary-dark transition-all shadow-md hover:shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Mettre en salle d'attente (Aujourd'hui)
                  </button>
                  <button
                    onClick={() => setShowRdvModal(true)}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <Calendar className="w-5 h-5" />
                    Planifier un rendez-vous (Futur)
                  </button>
                  <button
                    onClick={() => setShowAntecedentsModal(true)}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <ClipboardList className="w-5 h-5" />
                    Saisir les antécédents (carnet de santé...)
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                  >
                    Plus tard / Fermer
                  </button>
                </div>
              </div>
            ) : step === 1 ? (
              <div className="space-y-6">
                {/* Recherche de patients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rechercher un patient existant
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nom, prénom ou numéro de dossier..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Liste des patients */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Patients trouvés</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {patients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-medical-primary rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {patient.prenom} {patient.nom}
                            </p>
                            <p className="text-sm text-gray-500">
                              Dossier: {patient.numero_dossier} • Tél: {patient.telephone || 'Non renseigné'}
                            </p>
                          </div>
                        </div>
                        <div className="text-gray-400">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                    
                    {patients.length === 0 && searchTerm && (
                      <div className="text-center py-8">
                        <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">Aucun patient trouvé</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Séparateur */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">ou</span>
                  </div>
                </div>

                {/* Créer un nouveau patient */}
                <div>
                  <button
                    onClick={() => setShowNewPatientForm(!showNewPatientForm)}
                    className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-medical-primary hover:text-medical-primary transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un nouveau patient
                  </button>

                  {showNewPatientForm && (
                    <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Nouveau patient</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prénom *
                          </label>
                          <input
                            type="text"
                            value={newPatient.prenom}
                            onChange={(e) => setNewPatient({...newPatient, prenom: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom *
                          </label>
                          <input
                            type="text"
                            value={newPatient.nom}
                            onChange={(e) => setNewPatient({...newPatient, nom: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date de naissance *
                          </label>
                          <input
                            type="date"
                            value={newPatient.date_naissance}
                            onChange={(e) => handleNewPatientChange('date_naissance', e.target.value)}
                            max={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                              fieldErrors.date_naissance ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                          {fieldErrors.date_naissance && (
                            <p className="text-red-500 text-xs mt-1">{fieldErrors.date_naissance}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sexe
                          </label>
                          <select
                            value={newPatient.sexe}
                            onChange={(e) => setNewPatient({...newPatient, sexe: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          >
                            <option value="M">Masculin</option>
                            <option value="F">Féminin</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Téléphone
                          </label>
                          <input
                            type="tel"
                            value={newPatient.telephone}
                            onChange={(e) => setNewPatient({...newPatient, telephone: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={newPatient.email}
                            onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Numéro de dossier
                          </label>
                          <input
                            type="text"
                            value={newPatient.numero_dossier}
                            readOnly
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            placeholder="Généré automatiquement..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Adresse
                          </label>
                          <input
                            type="text"
                            value={newPatient.adresse}
                            onChange={(e) => setNewPatient({...newPatient, adresse: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Section Assurance */}
                      <div className="mt-6 pt-4 border-t border-gray-300">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Couverture médicale
                        </label>
                        <div className="flex space-x-6 mb-4">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="typeAssurance"
                              value="aucune"
                              checked={typeAssurance === 'aucune'}
                              onChange={(e) => setTypeAssurance(e.target.value)}
                              className="w-4 h-4 text-medical-primary focus:ring-medical-primary"
                            />
                            <span className="ml-2 text-sm text-gray-700">Aucune assurance</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="typeAssurance"
                              value="assurance"
                              checked={typeAssurance === 'assurance'}
                              onChange={(e) => setTypeAssurance(e.target.value)}
                              className="w-4 h-4 text-medical-primary focus:ring-medical-primary"
                            />
                            <span className="ml-2 text-sm text-gray-700">Avec assurance</span>
                          </label>
                        </div>

                        {/* Sélection d'assurance */}
                        {typeAssurance === 'assurance' && (
                          <div className="space-y-4">
                            <SearchableSelect
                              options={assurances.map(a => ({ ...a, label: a.nom }))}
                              value={selectedAssuranceId}
                              onChange={handleAssuranceChange}
                              placeholder="Sélectionner une assurance"
                              searchPlaceholder="Rechercher une assurance..."
                              label="Assurance"
                              required={false}
                              emptyMessage="Aucune assurance trouvée"
                            />

                            {/* Formulaire nouvelle assurance */}
                            {showNewAssuranceForm && (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                <h5 className="text-sm font-medium text-gray-700">Nouvelle assurance</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Nom de l'assurance *
                                    </label>
                                    <input
                                      type="text"
                                      value={newAssurance.nom}
                                      onChange={(e) => setNewAssurance({...newAssurance, nom: e.target.value})}
                                      placeholder="Ex: IPM, IPRES, AXA..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Type d'assurance
                                    </label>
                                    <select
                                      value={newAssurance.type_assurance}
                                      onChange={(e) => setNewAssurance({...newAssurance, type_assurance: e.target.value})}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
                                    >
                                      <option value="mutuelle">Mutuelle</option>
                                      <option value="securite_sociale">Sécurité sociale</option>
                                      <option value="privee">Privée</option>
                                      <option value="autre">Autre</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Taux de remboursement (%)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={newAssurance.taux_remboursement}
                                      onChange={(e) => setNewAssurance({...newAssurance, taux_remboursement: parseFloat(e.target.value) || 0})}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Description
                                    </label>
                                    <input
                                      type="text"
                                      value={newAssurance.description}
                                      onChange={(e) => setNewAssurance({...newAssurance, description: e.target.value})}
                                      placeholder="Description optionnelle"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleCreateNewPatient}
                          disabled={loading || Object.keys(fieldErrors).some(key => fieldErrors[key] !== '')}
                          className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Création...' : 'Créer le patient'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Patient sélectionné */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Patient sélectionné</h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-medical-primary rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedPatient.prenom} {selectedPatient.nom}
                      </p>
                      <p className="text-sm text-gray-500">
                        Dossier: {selectedPatient.numero_dossier} • Tél: {selectedPatient.telephone || 'Non renseigné'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sélection du médecin */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Médecin *
                  </label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Sélectionner un médecin</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.prenom} {doctor.nom} - {doctor.specialite}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priorité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="normale">Normale</option>
                    <option value="urgente">Urgente</option>
                    <option value="tres_urgente">Très urgente</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    placeholder="Informations supplémentaires..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {step !== 3 && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={step === 1 ? onClose : () => setStep(queueReturnStep)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {step === 1 ? 'Annuler' : 'Retour'}
            </button>
            
            {step === 2 && (
              <button
                onClick={handleAddToQueue}
                disabled={loading || !selectedDoctor}
                className="px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Ajout...' : 'Ajouter à la file d\'attente'}
              </button>
            )}
          </div>
          )}
        </div>
      </div>

      {showRdvModal && selectedPatient && (
        <CreateRdvModal 
          isOpen={showRdvModal}
          onClose={() => setShowRdvModal(false)}
          patientId={selectedPatient.id}
          isNewPatient
          addToQueueOnCreate={false}
          onSuccess={() => {
            setShowRdvModal(false);
            onPatientAdded();
            onClose();
          }}
        />
      )}

      {showAntecedentsModal && selectedPatient && (
        <PatientAntecedentsModal
          patient={selectedPatient}
          onClose={() => setShowAntecedentsModal(false)}
        />
      )}
    </>
  );
};

export default AddPatientModal;
