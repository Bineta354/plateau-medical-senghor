import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMontant } from '../../utils/currency';

const ListeProduits = () => {
  const [produits, setProduits] = useState([]);
  const [newProduit, setNewProduit] = useState({ 
    nom: '', 
    description: '', 
    code_atc: '',
    fabricant: '',
    prix: 0,
    stock: 0,
    actif: true 
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProduits();
  }, []);

  const fetchProduits = async () => {
    try {
      const { data, error } = await supabase
        .from('liste_produits')
        .select('*')
        .order('nom');
      
      if (error) throw error;
      setProduits(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('liste_produits')
          .update(newProduit)
          .eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('liste_produits')
          .insert([newProduit]);
        if (error) throw error;
      }
      
      setNewProduit({ nom: '', description: '', code_atc: '', fabricant: '', prix: 0, stock: 0, actif: true });
      fetchProduits();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (produit) => {
    setEditingId(produit.id);
    setNewProduit({
      nom: produit.nom,
      description: produit.description,
      code_atc: produit.code_atc,
      fabricant: produit.fabricant,
      prix: produit.prix,
      stock: produit.stock,
      actif: produit.actif
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        const { error } = await supabase
          .from('liste_produits')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchProduits();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const filteredProduits = produits.filter(produit =>
    produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produit.fabricant.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produit.code_atc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Liste des Produits</h1>
      
      <form onSubmit={handleSubmit} className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nom du produit</label>
            <input
              type="text"
              value={newProduit.nom}
              onChange={(e) => setNewProduit({...newProduit, nom: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Fabricant</label>
            <input
              type="text"
              value={newProduit.fabricant}
              onChange={(e) => setNewProduit({...newProduit, fabricant: e.target.value})}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Code ATC</label>
            <input
              type="text"
              value={newProduit.code_atc}
              onChange={(e) => setNewProduit({...newProduit, code_atc: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="A01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Prix (FCFA)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newProduit.prix}
              onChange={(e) => setNewProduit({...newProduit, prix: parseFloat(e.target.value) || 0})}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Stock</label>
            <input
              type="number"
              min="0"
              value={newProduit.stock}
              onChange={(e) => setNewProduit({...newProduit, stock: parseInt(e.target.value) || 0})}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newProduit.actif}
                onChange={(e) => setNewProduit({...newProduit, actif: e.target.checked})}
                className="mr-2"
              />
              Actif
            </label>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={newProduit.description}
            onChange={(e) => setNewProduit({...newProduit, description: e.target.value})}
            className="w-full p-2 border rounded"
            rows="3"
            placeholder="Description du produit, indications, contre-indications..."
          />
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {editingId ? 'Modifier' : 'Ajouter'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setNewProduit({ nom: '', description: '', code_atc: '', fabricant: '', prix: 0, stock: 0, actif: true });
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, fabricant ou code ATC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 p-2 border rounded"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fabricant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code ATC
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
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
            {filteredProduits.map((produit) => (
              <tr key={produit.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{produit.nom}</td>
                <td className="px-6 py-4 whitespace-nowrap">{produit.fabricant}</td>
                <td className="px-6 py-4 whitespace-nowrap font-mono">{produit.code_atc}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {produit.prix ? formatMontant(produit.prix) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    produit.stock > 10 ? 'bg-green-100 text-green-800' : 
                    produit.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {produit.stock}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate" title={produit.description}>
                    {produit.description}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    produit.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {produit.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(produit)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(produit.id)}
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
  );
};

export default ListeProduits;
