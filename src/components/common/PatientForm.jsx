import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../contexts/AlertContext';
import SearchableSelect from './SearchableSelect';
import { 
  User, 
  Phone, 
  FileText, 
  AlertTriangle,
  Search,
  X,
  CheckCircle
} from 'lucide-react';
import { generateNumeroDossier } from '../../services/patientService';
import { validatePatientForm, getDateNaissanceError, normalizePatientPayload } from '../../schemas/patientSchema';
import { formatTelephoneSN } from '../../utils/phone';

const PatientForm = ({ 
  initialData = null,
  onSubmit,
  onCancel,
  onAddAnother,
  title = "Ajouter un nouveau patient",
  submitText = "Terminer",
  showCancel = true,
  showAddAnother = false
}) => {
  console.log('🔍 [PatientForm] Props reçues - VERSION 2.0:', { showAddAnother, title, submitText });
  const { showError, showWarning } = useAlert();
  const [formData, setFormData] = useState({
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

  const [errors, setErrors] = useState({});
  
  // États pour la gestion des assurances
  const [assurances, setAssurances] = useState([]);
  const [typeAssurance, setTypeAssurance] = useState('aucune');
  const [selectedAssuranceId, setSelectedAssuranceId] = useState('');
  const [showNewAssuranceForm, setShowNewAssuranceForm] = useState(false);
  const [newAssurance, setNewAssurance] = useState({
    nom: '',
    type_assurance: 'mutuelle',
    taux_remboursement: 0,
    description: ''
  });
  const [loadingAssurances, setLoadingAssurances] = useState(false);

  // Charger les assurances au montage du composant
  useEffect(() => {
    fetchAssurances();
  }, []);

  // Générer automatiquement le numéro de dossier pour un nouveau patient
  useEffect(() => {
    if (!initialData) {
      generateNumeroDossier().then(numero => {
        setFormData(prev => ({ ...prev, numero_dossier: numero }));
      });
    }
  }, [initialData]);

  // Initialiser avec les données existantes si fournies
  useEffect(() => {
    if (initialData) {
      setFormData({
        nom: initialData.nom || '',
        prenom: initialData.prenom || '',
        date_naissance: initialData.date_naissance || '',
        telephone: initialData.telephone || '',
        email: initialData.email || '',
        adresse: initialData.adresse || '',
        assurance_id: initialData.assurance_id || null,
        numero_dossier: initialData.numero_dossier || '',
        sexe: initialData.sexe || 'M',
        lieu_naissance: initialData.lieu_naissance || '',
        nationalite: initialData.nationalite || 'français',
        profession: initialData.profession || '',
        situation_familiale: initialData.situation_familiale || '',
        personne_contact: initialData.personne_contact || '',
        telephone_contact: initialData.telephone_contact || '',
        lien_contact: initialData.lien_contact || '',
        medecin_traitant: initialData.medecin_traitant || '',
        numero_secu: initialData.numero_secu || '',
        actif: initialData.actif !== undefined ? initialData.actif : true,
        notes: initialData.notes || ''
      });
      
      // Définir le type d'assurance selon les données initiales
      if (initialData.assurance_id) {
        setTypeAssurance('assurance');
        setSelectedAssuranceId(initialData.assurance_id);
      }
    }
  }, [initialData]);

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
    } catch (error) {
      console.error('Erreur lors de la récupération des assurances:', error);
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

  const handleInputChange = (field, value) => {
    const nextValue = ['telephone', 'telephone_contact'].includes(field) ? formatTelephoneSN(value) : value;
    setFormData(prev => ({ ...prev, [field]: nextValue }));
    // Validation en temps réel pour la date de naissance
    if (field === 'date_naissance') {
      validateDateNaissanceRealTime(nextValue);
    } else {
      // Effacer l'erreur quand l'utilisateur commence à taper
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    }
  };

  const validateDateNaissanceRealTime = (value) => {
    setErrors(prev => ({ ...prev, date_naissance: getDateNaissanceError(value) }));
  };

  const validateForm = () => {
    const { isValid, errors: newErrors } = validatePatientForm(formData);
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      let assuranceIdToUse = null;

      // Si une assurance est sélectionnée
      if (typeAssurance === 'assurance') {
        // Si "Autre" est sélectionné, créer d'abord la nouvelle assurance
        if (selectedAssuranceId === 'autre') {
          if (!newAssurance.nom) {
            showWarning('Veuillez renseigner le nom de l\'assurance');
            return;
          }

          try {
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
          } catch (error) {
            console.error('Erreur lors de la création de l\'assurance:', error);
            showError('Erreur lors de la création de l\'assurance: ' + error.message);
            return;
          }
        } else if (selectedAssuranceId) {
          assuranceIdToUse = selectedAssuranceId;
        }
      }

      // Soumettre avec l'assurance_id
      const dataToSubmit = {
        ...formData,
        assurance_id: assuranceIdToUse
      };
      
      // Ne jamais envoyer numero_dossier lors de la modification
      if (initialData) {
        delete dataToSubmit.numero_dossier;
      }

      onSubmit(normalizePatientPayload(dataToSubmit));
    }
  };


  return (
    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-medical-primary" />
          {title}
        </h3>
        {showCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Informations de base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => handleInputChange('nom', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                errors.nom ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Nom du patient"
            />
            {errors.nom && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.nom}
              </p>
            )}
          </div>
          
          {/* Prénom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom *
            </label>
            <input
              type="text"
              value={formData.prenom}
              onChange={(e) => handleInputChange('prenom', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                errors.prenom ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Prénom du patient"
            />
            {errors.prenom && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.prenom}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date de naissance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance *
            </label>
            <input
              type="date"
              value={formData.date_naissance}
              onChange={(e) => handleInputChange('date_naissance', e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                errors.date_naissance ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.date_naissance && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.date_naissance}
              </p>
            )}
          </div>

          {/* Sexe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sexe
            </label>
            <select
              value={formData.sexe}
              onChange={(e) => handleInputChange('sexe', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => handleInputChange('telephone', e.target.value)}
                className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                  errors.telephone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="06 12 34 56 78"
              />
            </div>
            {errors.telephone && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.telephone}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="patient@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>
        </div>

        {/* Numéro de dossier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numéro de dossier
          </label>
          <input
            type="text"
            value={formData.numero_dossier}
            readOnly
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="Numéro de dossier unique"
          />
          <p className="text-xs text-gray-500 mt-1">
            Généré automatiquement — non modifiable
          </p>
        </div>

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adresse
          </label>
          <input
            type="text"
            value={formData.adresse}
            onChange={(e) => handleInputChange('adresse', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            placeholder="Adresse complète"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lieu de naissance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu de naissance
            </label>
            <input
              type="text"
              value={formData.lieu_naissance}
              onChange={(e) => handleInputChange('lieu_naissance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="Lieu de naissance"
            />
          </div>

          {/* Nationalité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nationalité
            </label>
            <input
              type="text"
              value={formData.nationalite}
              onChange={(e) => handleInputChange('nationalite', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="Nationalité"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profession */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profession
            </label>
            <input
              type="text"
              value={formData.profession}
              onChange={(e) => handleInputChange('profession', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="Profession"
            />
          </div>

          {/* Situation familiale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Situation familiale
            </label>
            <select
              value={formData.situation_familiale}
              onChange={(e) => handleInputChange('situation_familiale', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="">Sélectionner</option>
              <option value="celibataire">Célibataire</option>
              <option value="marie">Marié(e)</option>
              <option value="divorce">Divorcé(e)</option>
              <option value="veuf">Veuf/Veuve</option>
            </select>
          </div>
        </div>

        {/* Numéro FNR */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numéro FNR
          </label>
          <input
            type="text"
            value={formData.numero_secu}
            onChange={(e) => handleInputChange('numero_secu', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            placeholder="1 23 45 67 890 123 45"
          />
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

        {/* Médecin traitant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Médecin traitant
          </label>
          <input
            type="text"
            value={formData.medecin_traitant}
            onChange={(e) => handleInputChange('medecin_traitant', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            placeholder="Dr. Dupont"
          />
        </div>

        {/* Personne de contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personne de contact
            </label>
            <input
              type="text"
              value={formData.personne_contact}
              onChange={(e) => handleInputChange('personne_contact', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="Nom de la personne"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone de contact
            </label>
            <input
              type="tel"
              value={formData.telephone_contact}
              onChange={(e) => handleInputChange('telephone_contact', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="06 12 34 56 78"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lien avec la personne
            </label>
            <input
              type="text"
              value={formData.lien_contact}
              onChange={(e) => handleInputChange('lien_contact', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              placeholder="Conjoint, Parent, etc."
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            placeholder="Notes additionnelles sur le patient"
            rows={3}
          />
        </div>

        {/* Statut actif */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="actif"
            checked={formData.actif}
            onChange={(e) => handleInputChange('actif', e.target.checked)}
            className="h-4 w-4 text-medical-primary focus:ring-medical-primary border-gray-300 rounded"
          />
          <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">
            Patient actif
          </label>
        </div>
        
        {/* Boutons */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={Object.keys(errors).some(key => errors[key] !== '')}
            className="flex-1 bg-medical-primary hover:bg-medical-primary-dark text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            {submitText}
          </button>
          {showAddAnother && (
            <button
              type="button"
              onClick={() => {
                onAddAnother();
                // Réinitialiser le formulaire pour le prochain patient
                setFormData({
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
                setErrors({});
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Ajouter un autre patient
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PatientForm;
