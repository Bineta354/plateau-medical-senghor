import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase'
import SearchableSelect from '../../components/common/SearchableSelect';
import { generateNumeroDossier, validateBirthDate } from '../../services/patientService';
import { 
  ArrowLeft,
  Save,
  UserPlus,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  List,
  CheckCircle,
  X
} from 'lucide-react';

const PatientCreatePage = () => {
  const navigate = useNavigate();

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
    nationalite: 'sénégalais(e)',
    profession: '',
    situation_familiale: '',
    groupe_sanguin: '',
    assurance_id: null,
    numero_ipm: '',
    medecin_traitant_id: '', // ID du médecin
    medecin_traitant: '', // Nom du médecin (pour compatibilité)
    mutuelle: '',
    numero_mutuelle: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    actif: true,
    notes: ''
  });

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
  const [loadingAssurances, setLoadingAssurances] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  // Charger la liste des médecins
  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      console.log('🔵 [PatientCreate] Chargement des médecins...');
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, prenom, specialite')
        .eq('role', 'doctor')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setDoctors(data || []);
      console.log('✅ [PatientCreate] Médecins chargés:', data?.length || 0);
    } catch (error) {
      console.error('❌ [PatientCreate] Erreur chargement médecins:', error);
    }
  };

  // Charger les assurances au montage du composant
  useEffect(() => {
    fetchAssurances();
  }, []);

  // Générer automatiquement le numéro de dossier au montage du composant
  useEffect(() => {
    const generateNumeroDossierAuto = async () => {
      try {
        const numero = await generateNumeroDossier();
        setFormData(prev => ({ ...prev, numero_dossier: numero }));
      } catch (error) {
        console.error('Erreur lors de la génération du numéro de dossier:', error);
      }
    };
    generateNumeroDossierAuto();
  }, []);

  const fetchAssurances = async () => {
    try {
      setLoadingAssurances(true);
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
      console.log('✅ Assurances chargées:', data?.length || 0);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des assurances:', error);
    } finally {
      setLoadingAssurances(false);
    }
  };

  const handleAssuranceChange = (value) => {
    setSelectedAssuranceId(value);
    if (value === 'autre') {
      setShowNewAssuranceForm(true);
    } else {
      setShowNewAssuranceForm(false);
      setFormData(prev => ({ ...prev, assurance_id: value || null }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Validation en temps réel pour la date de naissance
    if (name === 'date_naissance') {
      validateDateNaissanceRealTime(value);
    } else {
      // Effacer l'erreur quand l'utilisateur commence à taper
      if (fieldErrors[name]) {
        setFieldErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  const validateDateNaissanceRealTime = (value) => {
    const newErrors = { ...fieldErrors };
    
    if (!value) {
      newErrors.date_naissance = 'La date de naissance est obligatoire';
    } else {
      const birthDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      
      if (birthDate > today) {
        newErrors.date_naissance = 'La date de naissance ne peut pas être dans le futur';
      } else if (birthDate > oneYearAgo) {
        newErrors.date_naissance = 'La date de naissance doit correspondre à un âge d\'au moins 1 an';
      } else {
        newErrors.date_naissance = '';
      }
    }
    
    setFieldErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est obligatoire';
    }
    
    if (!formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est obligatoire';
    }
    
    if (!formData.date_naissance) {
      newErrors.date_naissance = 'La date de naissance est obligatoire';
    } else {
      // Validation de la date de naissance
      const birthDate = new Date(formData.date_naissance);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normaliser à minuit pour comparaison juste
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      
      if (birthDate > today) {
        newErrors.date_naissance = 'La date de naissance ne peut pas être postérieure à aujourd\'hui';
      } else if (birthDate > oneYearAgo) {
        newErrors.date_naissance = 'La date de naissance doit correspondre à un âge d\'au moins 1 an';
      }
    }
    
    if (formData.telephone && !/^[0-9\s\+\-\(\)]{10,}$/.test(formData.telephone.replace(/\s/g, ''))) {
      newErrors.telephone = 'Format de téléphone invalide';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Valider le formulaire
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setError(Object.values(validationErrors).join(', '));
      return;
    }
    
    // Validation backend de la date de naissance
    const birthDateValidation = validateBirthDate(formData.date_naissance);
    if (!birthDateValidation.valid) {
      setError(birthDateValidation.error);
      return;
    }
    
    setLoading(true);
    setError(null);

    console.log('🔵 [PatientCreate] Début de la création du patient');
    console.log('📝 [PatientCreate] Données du formulaire:', formData);
    console.log('📝 [PatientCreate] Type d\'assurance sélectionné:', typeAssurance);

    try {
      let assuranceIdToUse = null;

      // Si une assurance est sélectionnée
      if (typeAssurance === 'assurance') {
        // Si "Autre" est sélectionné, créer d'abord la nouvelle assurance
        if (selectedAssuranceId === 'autre') {
          if (!newAssurance.nom) {
            setError('Veuillez renseigner le nom de l\'assurance');
            setLoading(false);
            return;
          }

          console.log('📝 [PatientCreate] Création d\'une nouvelle assurance:', newAssurance);
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

          if (assuranceError) {
            console.error('❌ [PatientCreate] Erreur création assurance:', assuranceError);
            throw assuranceError;
          }
          
          assuranceIdToUse = createdAssurance.id;
          console.log('✅ [PatientCreate] Assurance créée avec ID:', assuranceIdToUse);
        } else if (selectedAssuranceId) {
          assuranceIdToUse = selectedAssuranceId;
          console.log('✅ [PatientCreate] Assurance existante sélectionnée:', assuranceIdToUse);
        }
      }

      // Utiliser le numéro de dossier généré automatiquement
      const finalFormData = {
        ...formData,
        assurance_id: assuranceIdToUse
      };
      
      // Ne jamais envoyer numero_dossier dans le payload (généré automatiquement par le trigger)
      delete finalFormData.numero_dossier;

      // Mettre les champs médecin traitant à null (champ masqué de l'interface)
      finalFormData.medecin_traitant_id = null;
      finalFormData.medecin_traitant = null;
      // Si un médecin est sélectionné, ajouter son nom complet
      if (formData.medecin_traitant_id) {
        const selectedDoctor = doctors.find(d => d.id === parseInt(formData.medecin_traitant_id));
        if (selectedDoctor) {
          finalFormData.medecin_traitant = `Dr. ${selectedDoctor.prenom} ${selectedDoctor.nom}`;
        }
      }

      console.log('📤 [PatientCreate] Données finales à insérer:', finalFormData);
      console.log('🔵 [PatientCreate] Envoi de la requête INSERT à Supabase...');

      const { data, error } = await supabase
        .from('patients')
        .insert([finalFormData])
        .select()
        .single();

      if (error) {
        console.error('❌ [PatientCreate] Erreur Supabase:', error);
        console.error('❌ [PatientCreate] Code erreur:', error.code);
        console.error('❌ [PatientCreate] Message:', error.message);
        console.error('❌ [PatientCreate] Détails:', error.details);
        throw error;
      }

      console.log('✅ [PatientCreate] Patient créé avec succès!');
      console.log('✅ [PatientCreate] Données retournées:', data);
      console.log('✅ [PatientCreate] ID du patient:', data.id);
      
      // Afficher le toast de succès
      setSuccessMessage(`Patient ${data.prenom} ${data.nom} créé avec succès !`);
      setShowSuccessToast(true);
      
      // Rediriger après 2 secondes
      setTimeout(() => {
        console.log('🔵 [PatientCreate] Redirection vers la fiche du patient...');
        navigate(`/patients/details/${data.id}`, { 
          state: { message: 'Patient créé avec succès' }
        });
      }, 2000);
      
    } catch (error) {
      console.error('❌ [PatientCreate] Exception capturée:', error);
      setError('Erreur lors de la création du patient: ' + error.message);
    } finally {
      setLoading(false);
      console.log('🔵 [PatientCreate] Fin du processus de création');
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleViewPatients = () => {
    navigate('/fiche-identification');
  };

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
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Nouveau patient
              </h1>
              <p className="text-gray-600 mt-1">
                Créer un nouveau dossier patient
              </p>
            </div>
            <button
              onClick={handleViewPatients}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <List className="w-4 h-4 mr-2" />
              Voir tous les patients
            </button>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Informations personnelles */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Informations personnelles
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Nom de famille"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Prénom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance *</label>
                <input
                  type="date"
                  name="date_naissance"
                  value={formData.date_naissance}
                  onChange={handleInputChange}
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexe *</label>
                <select
                  name="sexe"
                  value={formData.sexe}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Groupe sanguin</label>
                <select
                  name="groupe_sanguin"
                  value={formData.groupe_sanguin}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="">Sélectionner</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
                <input
                  type="text"
                  name="lieu_naissance"
                  value={formData.lieu_naissance}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Dakar, Sénégal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
                <input
                  type="text"
                  name="nationalite"
                  value={formData.nationalite}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Sénégalaise"
                />
              </div>
            </div>

            {/* Contact et adresse */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Phone className="w-5 h-5 mr-2" />
                Contact et adresse
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input
                  type="tel"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="+221 77 123 45 67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="email@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <textarea
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Quartier Médina, Rue 10 x 11, Dakar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profession</label>
                <input
                  type="text"
                  name="profession"
                  value={formData.profession}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Enseignant, Commerçant, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situation familiale</label>
                <select
                  name="situation_familiale"
                  value={formData.situation_familiale}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="">Sélectionner</option>
                  <option value="celibataire">Célibataire</option>
                  <option value="marie">Marié(e)</option>
                  <option value="divorce">Divorcé(e)</option>
                  <option value="veuf">Veuf/Veuve</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personne à contacter</label>
                <input
                  type="text"
                  name="personne_contact"
                  value={formData.personne_contact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Nom de la personne"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone contact</label>
                <input
                  type="tel"
                  name="telephone_contact"
                  value={formData.telephone_contact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="+221 77 123 45 67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lien avec la personne de contact</label>
                <input
                  type="text"
                  name="lien_contact"
                  value={formData.lien_contact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Époux/Épouse, Parent, Enfant, etc."
                />
              </div>
            </div>

            {/* Informations médicales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Informations médicales
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de dossier</label>
                <input
                  type="text"
                  name="numero_dossier"
                  value={formData.numero_dossier}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Généré automatiquement"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Généré automatiquement — non modifiable
                </p>
              </div>

              {/* Section Assurance */}
              <div className="border-t border-gray-200 pt-4 mt-4">
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
                      onChange={(e) => {
                        setTypeAssurance(e.target.value);
                        setSelectedAssuranceId('');
                        setShowNewAssuranceForm(false);
                        setFormData(prev => ({ ...prev, assurance_id: null }));
                      }}
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
                      placeholder={loadingAssurances ? "Chargement..." : "Sélectionner une assurance"}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Notes additionnelles, allergies connues, antécédents importants..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="actif"
                  id="actif"
                  checked={formData.actif}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-medical-primary focus:ring-medical-primary border-gray-300 rounded"
                />
                <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">
                  Patient actif
                </label>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(fieldErrors).some(key => fieldErrors[key] !== '')}
              className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Création en cours...' : 'Créer le patient'}
            </button>
          </div>
        </form>

        {/* Informations importantes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Informations importantes</h3>
              <ul className="mt-2 text-sm text-blue-700 space-y-1">
                <li>• Les champs marqués d'un * sont obligatoires</li>
                <li>• Un numéro de dossier unique sera généré automatiquement</li>
                <li>• Les informations peuvent être modifiées après création</li>
                <li>• Le patient sera automatiquement marqué comme actif</li>
                <li>• Toutes les données sont sécurisées et confidentielles</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientCreatePage;
