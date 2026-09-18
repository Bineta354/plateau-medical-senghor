import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { ArrowLeft, Save } from 'lucide-react';

const MedecinsForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const medecinId = searchParams.get('id');
  const isEditMode = !!medecinId;

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    specialite: '',
    specialite_id: null,
    role: 'doctor',
    actif: true
  });
  const [parentSpecialites, setParentSpecialites] = useState([]);
  const [subSpecialites, setSubSpecialites] = useState([]); // All sub-specialties
  const [filteredSubSpecialites, setFilteredSubSpecialites] = useState([]); // For current parent
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (medecinId) {
      // loadMedecin calls fetchSpecialites internally, so we don't call it here to avoid double fetch/race conditions
      loadMedecin();
    } else {
      fetchSpecialites();
    }
  }, [medecinId]);

  const fetchSpecialites = async () => {
    try {
      const { data, error } = await supabase
        .from('specialites')
        .select('*')
        .order('nom');
      
      if (error) throw error;
      
      const parents = data.filter(s => !s.parent_id);
      const subs = data.filter(s => s.parent_id);
      
      setParentSpecialites(parents);
      setSubSpecialites(subs);
      return { parents, subs, all: data };
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      return { parents: [], subs: [], all: [] };
    }
  };

  const loadMedecin = async () => {
    try {
      setLoading(true);
      // Wait for specialties to be loaded first to set up the dropdowns correctly
      const { subs, all } = await fetchSpecialites();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', medecinId)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
        
        // Handle hierarchy initialization
        if (data.specialite_id) {
            const spec = all.find(s => s.id === data.specialite_id);
            if (spec) {
                if (spec.parent_id) {
                    // It's a sub-specialty
                    setSelectedParentId(spec.parent_id);
                    setFilteredSubSpecialites(subs.filter(s => s.parent_id === spec.parent_id));
                } else {
                    // It's a parent specialty
                    setSelectedParentId(spec.id);
                    setFilteredSubSpecialites(subs.filter(s => s.parent_id === spec.id));
                }
            }
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      unifiedNotificationService.error('Erreur lors du chargement du médecin');
    } finally {
      setLoading(false);
    }
  };

  // Handler for parent specialty change
  const handleParentChange = (e) => {
      const parentId = parseInt(e.target.value);
      setSelectedParentId(parentId);
      
      if (parentId) {
          const relatedSubs = subSpecialites.filter(s => s.parent_id === parentId);
          setFilteredSubSpecialites(relatedSubs);
          
          // Find the parent object to set name
          const parentObj = parentSpecialites.find(p => p.id === parentId);
          
          setFormData(prev => ({
              ...prev,
              specialite_id: parentId, // Default to parent ID
              specialite: parentObj ? parentObj.nom : ''
          }));
      } else {
          setFilteredSubSpecialites([]);
          setFormData(prev => ({
              ...prev,
              specialite_id: null,
              specialite: ''
          }));
      }
  };

  // Handler for sub-specialty change
  const handleSubChange = (e) => {
      const subId = parseInt(e.target.value);
      if (subId) {
          const subObj = filteredSubSpecialites.find(s => s.id === subId);
          setFormData(prev => ({
              ...prev,
              specialite_id: subId,
              specialite: subObj ? subObj.nom : prev.specialite
          }));
      } else {
          // Revert to parent if sub is cleared (optional, depending on UX)
          // Here we just keep the parent ID
          const parentObj = parentSpecialites.find(p => p.id === selectedParentId);
           setFormData(prev => ({
              ...prev,
              specialite_id: selectedParentId,
              specialite: parentObj ? parentObj.nom : ''
          }));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode) {
        const { data: updated, error } = await supabase
          .from('users')
          .update(formData)
          .eq('id', medecinId)
          .select('id');

        if (error) throw error;
        // Une mise à jour refusée par les règles de sécurité (RLS) ne renvoie aucune
        // erreur mais ne modifie aucune ligne : sans ce contrôle, on affichait « succès ».
        if (!updated || updated.length === 0) {
          throw new Error("modification refusée par la base (droits insuffisants sur cet utilisateur)");
        }
        unifiedNotificationService.success('Médecin modifié avec succès');
      } else {
        const { error } = await supabase
          .from('users')
          .insert([formData]);

        if (error) throw error;
        unifiedNotificationService.success('Médecin ajouté avec succès');
      }

      navigate('/parametrage/medecins');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      unifiedNotificationService.error('Erreur lors de la sauvegarde: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/parametrage/medecins');
  };

  if (loading && isEditMode) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Retour à la liste
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Modifier le médecin' : 'Nouveau médecin'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nom *</label>
            <input
              type="text"
              required
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prénom *</label>
            <input
              type="text"
              required
              value={formData.prenom}
              onChange={(e) => setFormData({...formData, prenom: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Téléphone</label>
            <input
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({...formData, telephone: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+221 XX XXX XX XX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Spécialité Principale</label>
            <select
              value={selectedParentId || ''}
              onChange={handleParentChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner une spécialité</option>
              {parentSpecialites.map((specialite) => (
                <option key={specialite.id} value={specialite.id}>
                  {specialite.nom}
                </option>
              ))}
            </select>
          </div>

          {filteredSubSpecialites.length > 0 && (
            <div className="animate-fade-in">
                <label className="block text-sm font-medium mb-2">Sous-spécialité</label>
                <select
                value={formData.specialite_id || ''}
                onChange={handleSubChange}
                className="w-full p-2 border border-blue-200 bg-blue-50 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                <option value={selectedParentId}>-- Générale --</option>
                {filteredSubSpecialites.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                    {sub.nom}
                    </option>
                ))}
                </select>
            </div>
          )}

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.actif}
                onChange={(e) => setFormData({...formData, actif: e.target.checked})}
                className="mr-2 rounded"
              />
              <span className="text-sm font-medium">Actif</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Enregistrement...' : (isEditMode ? 'Modifier' : 'Enregistrer')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedecinsForm;
