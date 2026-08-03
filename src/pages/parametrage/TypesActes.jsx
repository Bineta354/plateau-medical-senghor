import React, { useState, useMemo } from 'react';
import { useTypesActes } from '../../hooks/useTypesActes';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { Plus, Search, Edit2, Trash2, Filter, AlertCircle, Check } from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const ITEMS_PER_PAGE = 10;

const TypesActes = () => {
  const { 
    actes, 
    specialites, 
    loading, 
    error, 
    createTypeActe, 
    updateTypeActe, 
    deleteTypeActe 
  } = useTypesActes();

  // --- State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActe, setEditingActe] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    specialite: '',
    tarif: ''
  });
  
  // Form state
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    tarif_defaut: 0,
    specialite_ids: [],
    duree_estimee: 0,
    ordre_affichage: 0,
    actif: true
  });

  // --- Helpers ---
  const formatDuree = (minutes) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      description: '',
      tarif_defaut: 0,
      specialite_ids: [],
      duree_estimee: 0,
      ordre_affichage: 0,
      actif: true
    });
    setEditingActe(null);
  };

  // --- Handlers ---
  const handleOpenModal = (acte = null) => {
    if (acte) {
      setEditingActe(acte);
      setFormData({
        nom: acte.nom,
        description: acte.description || '',
        tarif_defaut: acte.tarif_defaut,
        specialite_ids: acte.specialite_ids || [],
        duree_estimee: acte.duree_estimee,
        ordre_affichage: acte.ordre_affichage,
        actif: acte.actif
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;
    if (editingActe) {
      result = await updateTypeActe(editingActe.id, formData);
    } else {
      result = await createTypeActe(formData);
    }

    if (result.success) {
      handleCloseModal();
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.id) {
      await deleteTypeActe(deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const handleSpecialiteToggle = (specId) => {
    setFormData(prev => {
      const currentIds = prev.specialite_ids || [];
      if (currentIds.includes(specId)) {
        return { ...prev, specialite_ids: currentIds.filter(id => id !== specId) };
      } else {
        return { ...prev, specialite_ids: [...currentIds, specId] };
      }
    });
  };

  // --- Filtering & Pagination ---
  const filteredActes = useMemo(() => {
    return actes.filter(acte => {
      const matchSearch = acte.nom.toLowerCase().includes(filters.search.toLowerCase()) ||
                          acte.description?.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchSpecialite = !filters.specialite || 
        (acte.specialite_ids && acte.specialite_ids.includes(parseInt(filters.specialite)));

      const matchTarif = !filters.tarif || 
        (filters.tarif === 'gratuit' && acte.tarif_defaut === 0) ||
        (filters.tarif === 'payant' && acte.tarif_defaut > 0);

      return matchSearch && matchSpecialite && matchTarif;
    });
  }, [actes, filters]);

  const totalPages = Math.ceil(filteredActes.length / ITEMS_PER_PAGE);
  const paginatedActes = filteredActes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // --- UI ---
  if (loading && actes.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Types d'Actes</h1>
          <p className="text-gray-500 mt-1">Gérez le catalogue des actes médicaux, tarifs et durées.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nouveau Type d'Acte
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un acte..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={filters.specialite}
              onChange={(e) => setFilters(prev => ({ ...prev, specialite: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">Toutes les spécialités</option>
              {specialites.map(s => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={filters.tarif}
              onChange={(e) => setFilters(prev => ({ ...prev, tarif: e.target.value }))}
              className="w-full pl-4 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">Tous les tarifs</option>
              <option value="gratuit">Gratuit</option>
              <option value="payant">Payant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg flex items-center gap-3">
          <AlertCircle className="text-red-500" />
          <p className="text-red-700">{error.message || "Une erreur est survenue."}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Acte</th>
                <th className="px-6 py-4">Tarif</th>
                <th className="px-6 py-4">Durée</th>
                <th className="px-6 py-4">Spécialités</th>
                <th className="px-6 py-4 text-center">Ordre</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedActes.length > 0 ? (
                paginatedActes.map((acte) => (
                  <tr key={acte.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{acte.nom}</div>
                      {acte.description && (
                        <div className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{acte.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {acte.tarif_defaut > 0 ? (
                        <span className="text-gray-900">{formatMontant(acte.tarif_defaut)}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                          Gratuit
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                      {formatDuree(acte.duree_estimee)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {acte.specialites_data && acte.specialites_data.length > 0 ? (
                          acte.specialites_data.map(spec => (
                            <span key={spec.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {spec.nom}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm italic">Aucune</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {acte.ordre_affichage}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        acte.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {acte.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(acte)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(acte.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-50 p-4 rounded-full mb-3">
                        <Search className="text-gray-400" size={24} />
                      </div>
                      <p className="text-lg font-medium text-gray-900">Aucun résultat trouvé</p>
                      <p className="text-sm">Essayez de modifier vos filtres ou ajoutez un nouvel acte.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="border-t border-gray-200">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingActe ? "Modifier le type d'acte" : "Nouveau type d'acte"}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'acte *</label>
              <input
                type="text"
                required
                value={formData.nom}
                onChange={e => setFormData({...formData, nom: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Ex: Consultation Générale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarif (FCFA)</label>
              <input
                type="number"
                min="0"
                step="500"
                value={formData.tarif_defaut}
                onChange={e => setFormData({...formData, tarif_defaut: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={formData.duree_estimee}
                onChange={e => setFormData({...formData, duree_estimee: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={formData.ordre_affichage}
                onChange={e => setFormData({...formData, ordre_affichage: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="flex items-center pt-6">
               <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={formData.actif}
                      onChange={e => setFormData({...formData, actif: e.target.checked})}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.actif ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.actif ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-sm font-medium text-gray-700">
                    Type d'acte actif
                  </div>
                </label>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Spécialités concernées</label>
              <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  {specialites.map(spec => (
                    <label key={spec.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        formData.specialite_ids.includes(spec.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                      }`}>
                         {formData.specialite_ids.includes(spec.id) && <Check size={12} className="text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.specialite_ids.includes(spec.id)}
                        onChange={() => handleSpecialiteToggle(spec.id)}
                      />
                      <span className="text-sm text-gray-700">{spec.nom}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Détails optionnels..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              {editingActe ? 'Enregistrer les modifications' : 'Créer le type d\'acte'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Supprimer le type d'acte"
        message="Êtes-vous sûr de vouloir supprimer ce type d'acte ? Cette action est irréversible."
        type="error"
        confirmText="Supprimer"
      />
    </div>
  );
};

export default TypesActes;
