import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../../lib/services';
import { validatePatientForm, getDateNaissanceError, normalizePatientPayload, getPatientUniqueConstraintMessage } from '../../schemas/patientSchema';
import { formatTelephoneSN, TELEPHONE_PLACEHOLDER } from '../../utils/phone';
import Dropdown from '../../components/common/Dropdown';
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
  Eye
} from 'lucide-react';

const PatientEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

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
    numero_ipm: '',
    groupe_sanguin: '',
    mutuelle: '',
    numero_mutuelle: '',
    nom_assurance: '',
    numero_assurance: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    actif: true,
    notes: ''
  });

  const [typeCouverture, setTypeCouverture] = useState(''); // 'ipm', 'assurance', 'mutuelle'
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (id) {
      loadPatient();
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setInitialLoading(true);
      const data = await patientService.getById(id);
      if (data) {
        // Formater la date pour l'input date
        const formattedData = {
          ...data,
          date_naissance: data.date_naissance ? data.date_naissance.split('T')[0] : ''
        };
        setFormData(formattedData);
        
        // Déterminer le type de couverture en fonction des données existantes
        if (data.numero_ipm) {
          setTypeCouverture('ipm');
        } else if (data.nom_assurance || data.numero_assurance) {
          setTypeCouverture('assurance');
        } else if (data.mutuelle || data.numero_mutuelle) {
          setTypeCouverture('mutuelle');
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setError('Erreur lors du chargement du patient');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const isPhoneField = name === 'telephone' || name === 'telephone_contact';
    const nextValue = isPhoneField ? formatTelephoneSN(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue
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
    setFieldErrors(prev => ({ ...prev, date_naissance: getDateNaissanceError(value) }));
  };

  const validateForm = () => {
    const { errors } = validatePatientForm(formData);
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Valider le formulaire
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(Object.values(validationErrors).join(', '));
      return;
    }

    setLoading(true);
    setError(null);

    console.log('🔵 [PatientEdit] Début de la modification du patient');
    console.log('📝 [PatientEdit] Données du formulaire:', formData);
    console.log('📝 [PatientEdit] Type de couverture sélectionné:', typeCouverture);

    try {
      // Préparer les données avec nettoyage selon le type de couverture
      const finalFormData = { ...formData };

      // Ne jamais envoyer numero_dossier dans le payload de mise à jour
      delete finalFormData.numero_dossier;

      // Mettre les champs médecin traitant à null (champ masqué de l'interface)
      finalFormData.medecin_traitant_id = null;
      finalFormData.medecin_traitant = null;

      // Nettoyer les champs de couverture selon le type sélectionné
      if (typeCouverture === 'ipm') {
        // Garder uniquement numero_ipm
        finalFormData.mutuelle = null;
        finalFormData.numero_mutuelle = null;
        finalFormData.nom_assurance = null;
        finalFormData.numero_assurance = null;
      } else if (typeCouverture === 'assurance') {
        // Garder uniquement nom_assurance et numero_assurance
        finalFormData.numero_ipm = null;
        finalFormData.mutuelle = null;
        finalFormData.numero_mutuelle = null;
      } else if (typeCouverture === 'mutuelle') {
        // Garder uniquement mutuelle et numero_mutuelle
        finalFormData.numero_ipm = null;
        finalFormData.nom_assurance = null;
        finalFormData.numero_assurance = null;
      } else {
        // Aucun type sélectionné, mettre tous les champs de couverture à null
        finalFormData.numero_ipm = null;
        finalFormData.mutuelle = null;
        finalFormData.numero_mutuelle = null;
        finalFormData.nom_assurance = null;
        finalFormData.numero_assurance = null;
      }

      const normalizedFormData = normalizePatientPayload(finalFormData);

      console.log('📤 [PatientEdit] Données finales à mettre à jour:', normalizedFormData);

      await patientService.update(id, normalizedFormData);

      console.log('✅ [PatientEdit] Patient modifié avec succès!');
      
      // Rediriger vers la page de détails avec un message de succès
      navigate(`/patients/details/${id}`, { 
        state: { message: 'Patient modifié avec succès' }
      });
    } catch (error) {
      console.error('❌ [PatientEdit] Erreur lors de la sauvegarde:', error);

      const uniqueConstraintMessage = getPatientUniqueConstraintMessage(error);
      // Vérifier si c'est l'erreur spécifique de modification du numéro de dossier
      const errorMessage = error.message || error.details || error.hint || String(error);
      if (uniqueConstraintMessage) {
        setError(uniqueConstraintMessage);
      } else if (errorMessage.includes('impossible de modifier le numéro de dossier')) {
        setError('Désolé, il est impossible de modifier le numéro de dossier.');
      } else {
        setError('Erreur lors de la sauvegarde: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleViewDetails = () => {
    navigate(`/patients/details/${id}`);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !formData.nom) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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
                Modifier le patient
              </h1>
              <p className="text-gray-600 mt-1">
                {formData.prenom} {formData.nom}
              </p>
            </div>
            <button
              onClick={handleViewDetails}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2" />
              Voir les détails
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
                <Dropdown
                  value={formData.sexe}
                  onChange={(value) => handleInputChange({ target: { name: 'sexe', value } })}
                  options={[
                    { value: 'M', label: 'Masculin' },
                    { value: 'F', label: 'Féminin' },
                  ]}
                  size="md"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
                <input
                  type="text"
                  name="lieu_naissance"
                  value={formData.lieu_naissance}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Ville, Pays"
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
                  maxLength={11}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent ${
                    fieldErrors.telephone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={TELEPHONE_PLACEHOLDER}
                />
                {fieldErrors.telephone && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.telephone}</p>
                )}
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
                  placeholder="Adresse complète"
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
                  placeholder="Profession"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situation familiale</label>
                <Dropdown
                  value={formData.situation_familiale}
                  onChange={(value) => handleInputChange({ target: { name: 'situation_familiale', value } })}
                  options={[
                    { value: '', label: 'Sélectionner' },
                    { value: 'celibataire', label: 'Célibataire' },
                    { value: 'marie', label: 'Marié(e)' },
                    { value: 'divorce', label: 'Divorcé(e)' },
                    { value: 'veuf', label: 'Veuf/Veuve' },
                  ]}
                  size="md"
                  className="w-full"
                />
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
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder={TELEPHONE_PLACEHOLDER}
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
                  placeholder="Conjoint, Parent, etc."
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
                  placeholder="Numéro de dossier unique"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Généré automatiquement — non modifiable
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Groupe sanguin</label>
                <Dropdown
                  value={formData.groupe_sanguin}
                  onChange={(value) => handleInputChange({ target: { name: 'groupe_sanguin', value } })}
                  options={[
                    { value: '', label: 'Sélectionner' },
                    { value: 'A+', label: 'A+' },
                    { value: 'A-', label: 'A-' },
                    { value: 'B+', label: 'B+' },
                    { value: 'B-', label: 'B-' },
                    { value: 'AB+', label: 'AB+' },
                    { value: 'AB-', label: 'AB-' },
                    { value: 'O+', label: 'O+' },
                    { value: 'O-', label: 'O-' },
                  ]}
                  size="md"
                  className="w-full"
                />
              </div>

              {/* Radio buttons pour type de couverture */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Type de couverture</label>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="typeCouverture"
                      value="ipm"
                      checked={typeCouverture === 'ipm'}
                      onChange={(e) => setTypeCouverture(e.target.value)}
                      className="h-4 w-4 text-medical-primary focus:ring-medical-primary border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">IPM</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="typeCouverture"
                      value="assurance"
                      checked={typeCouverture === 'assurance'}
                      onChange={(e) => setTypeCouverture(e.target.value)}
                      className="h-4 w-4 text-medical-primary focus:ring-medical-primary border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Assurance</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="typeCouverture"
                      value="mutuelle"
                      checked={typeCouverture === 'mutuelle'}
                      onChange={(e) => setTypeCouverture(e.target.value)}
                      className="h-4 w-4 text-medical-primary focus:ring-medical-primary border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Mutuelle</span>
                  </label>
                </div>
              </div>

              {/* Affichage conditionnel selon le type de couverture */}
              {typeCouverture === 'ipm' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro IPM</label>
                  <input
                    type="text"
                    name="numero_ipm"
                    value={formData.numero_ipm}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    placeholder="Numéro IPM ou CSS"
                  />
                </div>
              )}

              {typeCouverture === 'assurance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom Assurance</label>
                    <input
                      type="text"
                      name="nom_assurance"
                      value={formData.nom_assurance}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                      placeholder="Nom de l'assurance"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro Assurance</label>
                    <input
                      type="text"
                      name="numero_assurance"
                      value={formData.numero_assurance}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                      placeholder="Numéro de police d'assurance"
                    />
                  </div>
                </>
              )}

              {typeCouverture === 'mutuelle' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mutuelle</label>
                    <input
                      type="text"
                      name="mutuelle"
                      value={formData.mutuelle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                      placeholder="IPM, IPRES, etc."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro Mutuelle</label>
                    <input
                      type="text"
                      name="numero_mutuelle"
                      value={formData.numero_mutuelle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                      placeholder="Numéro d'adhérent"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Notes additionnelles sur le patient..."
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
              {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
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
                <li>• Les modifications seront sauvegardées immédiatement</li>
                <li>• Vous pouvez désactiver un patient en décochant "Patient actif"</li>
                <li>• Les informations médicales sensibles sont protégées</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientEditPage;
