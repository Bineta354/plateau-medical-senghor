import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
import { formatTelephoneSN } from '../utils/phone';

const PatientForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id');
  const isViewMode = searchParams.get('view') === 'true';
  const isEditMode = !!patientId && !isViewMode;

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
    medecin_traitant: '',
    mutuelle: '',
    numero_mutuelle: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    actif: true,
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadPatient();
    }
  }, [patientId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      if (data) setFormData(data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      unifiedNotificationService.error('Erreur lors du chargement du patient');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['telephone', 'telephone_contact'].includes(name) ? formatTelephoneSN(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode) {
        // Ne jamais envoyer numero_dossier dans le payload de mise à jour
        const updateData = { ...formData };
        delete updateData.numero_dossier;
        
        const { error } = await supabase
          .from('patients')
          .update(updateData)
          .eq('id', patientId);

        if (error) throw error;
        unifiedNotificationService.success('Patient modifié avec succès');
      } else {
        // Ne jamais envoyer numero_dossier dans le payload de création
        const insertData = { ...formData };
        delete insertData.numero_dossier;
        
        const { error } = await supabase
          .from('patients')
          .insert([insertData]);

        if (error) throw error;
        unifiedNotificationService.success('Patient ajouté avec succès');
      }

      navigate('/rendez-vous/fiche-patient');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      
      // Vérifier si c'est l'erreur spécifique de modification du numéro de dossier
      const errorMessage = error.message || error.details || error.hint || String(error);
      if (errorMessage.includes('impossible de modifier le numéro de dossier')) {
        unifiedNotificationService.warning('Désolé, il est impossible de modifier le numéro de dossier.');
      } else {
        unifiedNotificationService.error('Erreur lors de la sauvegarde: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/rendez-vous/fiche-patient');
  };

  if (loading && isEditMode) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour à la liste
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isViewMode ? 'Détails du patient' : isEditMode ? 'Modifier le patient' : 'Nouveau patient'}
          </h1>
        </div>

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
                  disabled={isViewMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="+221 XX XXX XX XX"
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
                  placeholder="Numéro de dossier unique (IPM/CSS)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Généré automatiquement — non modifiable
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro IPM/CSS</label>
                <input
                  type="text"
                  name="numero_ipm"
                  value={formData.numero_ipm}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Numéro IPM ou CSS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mutuelle</label>
                <input
                  type="text"
                  name="mutuelle"
                  value={formData.mutuelle}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Nom de la mutuelle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro mutuelle</label>
                <input
                  type="text"
                  name="numero_mutuelle"
                  value={formData.numero_mutuelle}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Numéro d'adhérent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médecin traitant</label>
                <input
                  type="text"
                  name="medecin_traitant"
                  value={formData.medecin_traitant}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Dr. Nom du médecin"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="+221 XX XXX XX XX"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Notes additionnelles sur le patient..."
                />
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
              {isViewMode ? 'Retour' : 'Annuler'}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Enregistrement...' : (isEditMode ? 'Modifier' : 'Enregistrer')}
              </button>
            )}
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
                <li>• Le numéro IPM/CSS est optionnel mais recommandé</li>
                <li>• Les informations médicales peuvent être complétées ultérieurement</li>
                <li>• Un dossier patient sera automatiquement créé après enregistrement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientForm;
