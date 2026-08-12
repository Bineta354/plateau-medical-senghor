import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const ElementsSynthese = () => {
  const [elements, setElements] = useState([]);
  const [newElement, setNewElement] = useState({ 
    nom: '', 
    description: '', 
    categorie: 'generale',
    type_element: 'observation',
    ordre_affichage: 0,
    actif: true 
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterType, setFilterType] = useState('');

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

  // Doit rester synchronisé avec la contrainte CHECK(type_element IN (...))
  // sur la table elements_synthese (migration 20250102000002_phase2_parametrage_medical.sql).
  const typesElements = [
    { value: 'observation', label: 'Observation', color: 'bg-blue-100 text-blue-800' },
    { value: 'conclusion', label: 'Conclusion', color: 'bg-purple-100 text-purple-800' },
    { value: 'recommandation', label: 'Recommandation', color: 'bg-green-100 text-green-800' },
    { value: 'prescription', label: 'Prescription', color: 'bg-orange-100 text-orange-800' }
  ];

  useEffect(() => {
    fetchElements();
  }, []);

  const fetchElements = async () => {
    try {
      const { data, error } = await supabase
        .from('elements_synthese')
        .select('*')
        .order('ordre_affichage', { ascending: true });

      if (error) throw error;
      setElements(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des éléments de synthèse:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from('elements_synthese')
          .update(newElement)
          .eq('id', editingId);
        
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('elements_synthese')
          .insert([newElement]);
        
        if (error) throw error;
      }

      setNewElement({ 
        nom: '', 
        description: '', 
        categorie: 'generale',
        type_element: 'observation',
        ordre_affichage: 0,
        actif: true 
      });
      fetchElements();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (element) => {
    setEditingId(element.id);
    setNewElement(element);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet élément de synthèse ?')) {
      try {
        const { error } = await supabase
          .from('elements_synthese')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        fetchElements();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const filteredElements = elements.filter(element => {
    const matchesSearch = element.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         element.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategorie = !filterCategorie || element.categorie === filterCategorie;
    const matchesType = !filterType || element.type_element === filterType;
    
    return matchesSearch && matchesCategorie && matchesType;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Éléments de Synthèse</h1>
        <p className="text-gray-600">Gérez les éléments pouvant faire l'objet d'une synthèse de consultation</p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Modifier l\'élément' : 'Ajouter un élément'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                required
                value={newElement.nom}
                onChange={(e) => setNewElement({...newElement, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom de l'élément"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'élément
              </label>
              <select
                value={newElement.type_element}
                onChange={(e) => setNewElement({...newElement, type_element: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {typesElements.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                value={newElement.categorie}
                onChange={(e) => setNewElement({...newElement, categorie: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ordre d'affichage
              </label>
              <input
                type="number"
                value={newElement.ordre_affichage}
                onChange={(e) => setNewElement({...newElement, ordre_affichage: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="actif"
                checked={newElement.actif}
                onChange={(e) => setNewElement({...newElement, actif: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">
                Actif
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newElement.description}
              onChange={(e) => setNewElement({...newElement, description: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Description de l'élément de synthèse"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {editingId ? 'Modifier' : 'Ajouter'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setNewElement({ 
                    nom: '', 
                    description: '', 
                    categorie: 'generale',
                    type_element: 'observation',
                    ordre_affichage: 0,
                    actif: true 
                  });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rechercher par nom ou description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={filterCategorie}
              onChange={(e) => setFilterCategorie(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              {typesElements.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Liste des Éléments de Synthèse ({filteredElements.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Élément
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ordre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredElements.map((element) => (
                <tr key={element.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{element.nom}</div>
                      {element.description && (
                        <div className="text-sm text-gray-500">{element.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${typesElements.find(t => t.value === element.type_element)?.color || 'bg-gray-100 text-gray-800'}`}>
                      {typesElements.find(t => t.value === element.type_element)?.label || element.type_element}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {categories.find(cat => cat.value === element.categorie)?.label || element.categorie}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {element.ordre_affichage}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${element.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {element.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(element)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(element.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ElementsSynthese;
