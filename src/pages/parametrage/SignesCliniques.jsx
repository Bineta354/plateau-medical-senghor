import React, { useState, useEffect } from 'react';
import ParametrageLayout from '../../components/ParametrageLayout';
import { signesCliniquesRefService } from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';

const EMPTY_ITEM = { nom: '', description: '', categorie: 'generale', actif: true };

const categories = [
  { value: 'generale', label: 'Général' },
  { value: 'neurologique', label: 'Neurologique' },
  { value: 'dermatologique', label: 'Dermatologique' },
  { value: 'cardiovasculaire', label: 'Cardiovasculaire' },
  { value: 'respiratoire', label: 'Respiratoire' },
  { value: 'orthopedique', label: 'Orthopédique' },
  { value: 'dentaire', label: 'Dentaire' },
  { value: 'parodontal', label: 'Parodontal' },
  { value: 'muqueuse', label: 'Muqueuse' },
  { value: 'fonctionnel', label: 'Fonctionnel' },
  { value: 'salivaire', label: 'Salivaire' },
];

const SignesCliniques = () => {
  const [items, setItems] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [selectedSpecialites, setSelectedSpecialites] = useState([]);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');

  useEffect(() => {
    fetchSpecialites();
    fetchItems();
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

  const fetchItems = async () => {
    try {
      const data = await signesCliniquesRefService.list();
      setItems(data);
    } catch (error) {
      console.error('Erreur lors du chargement des signes cliniques:', error);
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
        nom: newItem.nom,
        description: newItem.description || null,
        categorie: newItem.categorie,
        actif: newItem.actif
      };

      let itemId = editingId;
      if (editingId) {
        await signesCliniquesRefService.update(editingId, dataToSave);
      } else {
        const created = await signesCliniquesRefService.create(dataToSave);
        itemId = created.id;
      }

      await signesCliniquesRefService.syncSpecialites(itemId, selectedSpecialites);

      setNewItem(EMPTY_ITEM);
      setSelectedSpecialites([]);
      setShowForm(false);
      setEditingId(null);
      fetchItems();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNewItem({
      nom: item.nom,
      description: item.description || '',
      categorie: item.categorie || 'generale',
      actif: item.actif
    });
    setSelectedSpecialites(item.signes_cliniques_specialites?.map(lnk => lnk.specialite_id) || []);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setNewItem(EMPTY_ITEM);
    setSelectedSpecialites([]);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewItem(EMPTY_ITEM);
    setSelectedSpecialites([]);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
      try {
        await signesCliniquesRefService.remove(id);
        fetchItems();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const getSpecsForItem = (item) =>
    item.signes_cliniques_specialites?.map(lnk => lnk.specialites?.nom).filter(Boolean) || [];

  const filteredItems = items.filter(item => {
    const matchSearch = item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = !filterSpecialite ||
      item.signes_cliniques_specialites?.some(lnk => lnk.specialite_id === parseInt(filterSpecialite));
    const matchCat = !filterCategorie || item.categorie === filterCategorie;
    return matchSearch && matchSpec && matchCat;
  });

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div>
      <ParametrageLayout
        title="Signes Cliniques"
        addButtonText={editingId ? 'Modifier' : 'Ajouter'}
        showForm={showForm}
        onAddClick={handleAddNew}
        onCancelClick={handleCancel}
      >
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom *</label>
                <input
                  type="text"
                  value={newItem.nom}
                  onChange={(e) => setNewItem({ ...newItem, nom: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catégorie</label>
                <select
                  value={newItem.categorie}
                  onChange={(e) => setNewItem({ ...newItem, categorie: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="2"
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

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={newItem.actif}
                  onChange={(e) => setNewItem({ ...newItem, actif: e.target.checked })}
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
      </ParametrageLayout>

      <div className="px-6">
        {/* Filtres */}
        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Rechercher par nom ou description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <select value={filterSpecialite} onChange={(e) => setFilterSpecialite(e.target.value)} className="p-2 border rounded">
            <option value="">Toutes les spécialités</option>
            {specialites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
          <select value={filterCategorie} onChange={(e) => setFilterCategorie(e.target.value)} className="p-2 border rounded">
            <option value="">Toutes les catégories</option>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spécialités</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actif</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const specs = getSpecsForItem(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{item.nom}</div>
                      {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {categories.find(c => c.value === item.categorie)?.label || item.categorie}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 mr-3">Modifier</button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SignesCliniques;