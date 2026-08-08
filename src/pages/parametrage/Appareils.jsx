import React, { useState, useEffect } from 'react';
import ParametrageLayout from '../../components/ParametrageLayout';
import ParametrageList from '../../components/ParametrageList';
import { appareilsRefService } from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';

const EMPTY_APPAREIL = { nom: '', description: '', ordre_affichage: 0, actif: true };

const Appareils = () => {
  const [appareils, setAppareils] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [selectedSpecialites, setSelectedSpecialites] = useState([]);
  const [newAppareil, setNewAppareil] = useState(EMPTY_APPAREIL);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState('');

  useEffect(() => {
    fetchSpecialites();
    fetchAppareils();
  }, []);

  const fetchSpecialites = async () => {
    try {
      const data = await specialtyService.getAll();
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchAppareils = async () => {
    try {
      const data = await appareilsRefService.list();
      setAppareils(data);
    } catch (error) {
      console.error('Erreur lors du chargement des appareils:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialite = (specId) => {
    setSelectedSpecialites(prev =>
      prev.includes(specId) ? prev.filter(s => s !== specId) : [...prev, specId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        nom: newAppareil.nom,
        description: newAppareil.description || null,
        ordre_affichage: parseInt(newAppareil.ordre_affichage) || 0,
        actif: newAppareil.actif
      };

      let appareilId = editingId;
      if (editingId) {
        await appareilsRefService.update(editingId, dataToSave);
      } else {
        const created = await appareilsRefService.create(dataToSave);
        appareilId = created.id;
      }

      await appareilsRefService.syncSpecialites(appareilId, selectedSpecialites);

      setNewAppareil(EMPTY_APPAREIL);
      setSelectedSpecialites([]);
      setShowForm(false);
      setEditingId(null);
      fetchAppareils();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (appareil) => {
    setEditingId(appareil.id);
    setNewAppareil({
      nom: appareil.nom,
      description: appareil.description || '',
      ordre_affichage: appareil.ordre_affichage || 0,
      actif: appareil.actif
    });
    setSelectedSpecialites(appareil.appareils_specialites?.map(lnk => lnk.specialite_id) || []);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setNewAppareil(EMPTY_APPAREIL);
    setSelectedSpecialites([]);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewAppareil(EMPTY_APPAREIL);
    setSelectedSpecialites([]);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet appareil ?')) {
      try {
        await appareilsRefService.remove(id);
        fetchAppareils();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const getSpecsForAppareil = (ap) =>
    ap.appareils_specialites?.map(lnk => lnk.specialites?.nom).filter(Boolean) || [];

  const filteredAppareils = appareils.filter(ap => {
    const matchSearch = ap.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ap.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = !filterSpecialite ||
      ap.appareils_specialites?.some(lnk => lnk.specialite_id === parseInt(filterSpecialite));
    return matchSearch && matchSpec;
  });

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div>
      <ParametrageLayout
        title="Appareils"
        addButtonText={editingId ? 'Modifier appareil' : 'Ajouter appareil'}
        showForm={showForm}
        onAddClick={handleAddNew}
        onCancelClick={handleCancel}
      >
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'appareil *</label>
                <input
                  type="text"
                  required
                  value={newAppareil.nom}
                  onChange={(e) => setNewAppareil({ ...newAppareil, nom: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ordre d'affichage</label>
                <input
                  type="number"
                  value={newAppareil.ordre_affichage}
                  onChange={(e) => setNewAppareil({ ...newAppareil, ordre_affichage: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={newAppareil.description}
                onChange={(e) => setNewAppareil({ ...newAppareil, description: e.target.value })}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sélecteur de spécialités */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spécialités concernées
                <span className="text-gray-400 font-normal ml-2 text-xs">(aucune = toutes)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {specialites.map(spec => {
                  const isSelected = selectedSpecialites.includes(spec.id);
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => toggleSpecialite(spec.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {spec.nom}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={newAppareil.actif}
                  onChange={(e) => setNewAppareil({ ...newAppareil, actif: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                Actif
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                {editingId ? 'Modifier' : 'Ajouter'}
              </button>
              <button type="button" onClick={handleCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Rechercher par nom ou description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <select value={filterSpecialite} onChange={(e) => setFilterSpecialite(e.target.value)} className="p-2 border rounded">
            <option value="">Toutes les spécialités</option>
            {specialites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appareil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spécialités</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAppareils.map((ap) => {
                const specs = getSpecsForAppareil(ap);
                return (
                  <tr key={ap.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{ap.nom}</div>
                      {ap.description && <div className="text-sm text-gray-500">{ap.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {specs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {specs.map(nom => (
                            <span key={nom} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{nom}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Toutes</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{ap.ordre_affichage}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ap.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {ap.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleEdit(ap)} className="text-indigo-600 hover:text-indigo-900 mr-3">Modifier</button>
                      <button onClick={() => handleDelete(ap.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ParametrageLayout>
    </div>
  );
};

export default Appareils;
