import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { antecedentsRefService } from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';

const AntecedentsForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    categorie: 'generale',
    code_cim: '',
    niveau_gravite: 'leger',
    ordre_affichage: 0,
    actif: true
  });

  // IDs des spécialités sélectionnées pour cet antécédent
  const [selectedSpecialites, setSelectedSpecialites] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const categories = [
    { value: 'generale', label: 'Générale' },
    { value: 'cardiovasculaire', label: 'Cardiovasculaire' },
    { value: 'respiratoire', label: 'Respiratoire' },
    { value: 'digestif', label: 'Digestif' },
    { value: 'neurologique', label: 'Neurologique' },
    { value: 'metabolique', label: 'Métabolique' },
    { value: 'oncologique', label: 'Oncologique' },
    { value: 'allergique', label: 'Allergique' },
    { value: 'chirurgical', label: 'Chirurgical' },
    { value: 'traumatologique', label: 'Traumatologique' },
    { value: 'psychiatrique', label: 'Psychiatrique' }
  ];

  const niveauxGravite = [
    { value: 'leger', label: 'Léger', color: 'bg-green-100 text-green-800' },
    { value: 'modere', label: 'Modéré', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'grave', label: 'Grave', color: 'bg-orange-100 text-orange-800' },
    { value: 'critique', label: 'Critique', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    fetchSpecialites();
    if (isEditing) {
      fetchAntecedent();
    }
  }, [id, isEditing]);

  const fetchSpecialites = async () => {
    try {
      const data = await specialtyService.getAll();
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchAntecedent = async () => {
    try {
      setLoading(true);
      const { item, specialiteIds } = await antecedentsRefService.getById(id);

      if (item) {
        setFormData(item);
      }
      setSelectedSpecialites(specialiteIds);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'antécédent:', error);
      setErrors({ general: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialite = (specId) => {
    setSelectedSpecialites(prev =>
      prev.includes(specId)
        ? prev.filter(s => s !== specId)
        : [...prev, specId]
    );
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est obligatoire';
    }

    if (formData.nom.length > 255) {
      newErrors.nom = 'Le nom ne peut pas dépasser 255 caractères';
    }

    if (formData.code_cim && formData.code_cim.length > 10) {
      newErrors.code_cim = 'Le code CIM ne peut pas dépasser 10 caractères';
    }

    if (formData.ordre_affichage < 0) {
      newErrors.ordre_affichage = 'L\'ordre d\'affichage doit être positif';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      const dataToSave = {
        ...formData,
        ordre_affichage: parseInt(formData.ordre_affichage) || 0
      };

      let antecedentId = id;

      if (isEditing) {
        await antecedentsRefService.update(id, dataToSave);
      } else {
        const created = await antecedentsRefService.create(dataToSave);
        antecedentId = created.id;
      }

      await antecedentsRefService.syncSpecialites(antecedentId, selectedSpecialites);

      navigate('/parametrage/antecedents', {
        state: {
          message: isEditing
            ? 'Antécédent modifié avec succès'
            : 'Antécédent créé avec succès',
          type: 'success'
        }
      });

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setErrors({
        general: error.message || 'Erreur lors de la sauvegarde'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleCancel = () => {
    navigate('/parametrage/antecedents');
  };

  if (loading && isEditing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour à la liste
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isEditing ? 'Modifier l\'antécédent' : 'Nouvel antécédent'}
        </h1>
        <p className="text-gray-600">
          {isEditing
            ? 'Modifiez les informations de l\'antécédent médical'
            : 'Créez un nouvel antécédent médical pour le système'
          }
        </p>
      </div>

      {/* Messages d'erreur généraux */}
      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow-md">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Informations de base */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations de base
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de l'antécédent *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => handleInputChange('nom', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.nom ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Hypertension artérielle"
                  />
                  {errors.nom && (
                    <p className="mt-1 text-sm text-red-600">{errors.nom}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code CIM-10
                  </label>
                  <input
                    type="text"
                    value={formData.code_cim}
                    onChange={(e) => handleInputChange('code_cim', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.code_cim ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Ex: I10"
                  />
                  {errors.code_cim && (
                    <p className="mt-1 text-sm text-red-600">{errors.code_cim}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Classification */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Classification
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={formData.categorie}
                    onChange={(e) => handleInputChange('categorie', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Niveau de gravité
                  </label>
                  <select
                    value={formData.niveau_gravite}
                    onChange={(e) => handleInputChange('niveau_gravite', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {niveauxGravite.map(niveau => (
                      <option key={niveau.value} value={niveau.value}>
                        {niveau.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Spécialités associées */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Spécialités concernées
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Sélectionnez les spécialités pour lesquelles cet antécédent est pertinent.
                Si aucune n'est sélectionnée, l'antécédent sera visible pour toutes les spécialités.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {specialites.map(spec => {
                  const isSelected = selectedSpecialites.includes(spec.id);
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => toggleSpecialite(spec.id)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {spec.nom}
                    </button>
                  );
                })}
              </div>
              {selectedSpecialites.length > 0 && (
                <p className="mt-2 text-sm text-blue-600">
                  {selectedSpecialites.length} spécialité(s) sélectionnée(s)
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description détaillée de l'antécédent..."
              />
            </div>

            {/* Paramètres */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Paramètres
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordre d'affichage
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.ordre_affichage}
                    onChange={(e) => handleInputChange('ordre_affichage', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.ordre_affichage ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.ordre_affichage && (
                    <p className="mt-1 text-sm text-red-600">{errors.ordre_affichage}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Plus le nombre est petit, plus l'antécédent apparaîtra en haut de la liste
                  </p>
                </div>

                <div className="flex items-center">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="actif"
                      checked={formData.actif}
                      onChange={(e) => handleInputChange('actif', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="actif" className="text-sm font-medium text-gray-700">
                      Antécédent actif
                    </label>
                    <p className="text-sm text-gray-500">
                      Les antécédents inactifs ne seront pas proposés lors de la saisie
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Enregistrement...' : (isEditing ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AntecedentsForm;
