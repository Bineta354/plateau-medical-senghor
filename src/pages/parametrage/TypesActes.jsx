import React, { useState, useEffect, useMemo } from 'react';
import { useTypesActes } from '../../hooks/useTypesActes';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Dropdown from '../../components/common/Dropdown';
import KpiCard from '../../components/common/KpiCard';
import {
  ClipboardList,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const TARIF_OPTIONS = [
  { value: '', label: 'Tous les tarifs' },
  { value: 'gratuit', label: 'Gratuit' },
  { value: 'payant', label: 'Payant' },
];

const PAGE_SIZE_OPTIONS = [
  { value: '5', label: '5 / page' },
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

const TypesActes = () => {
  const {
    actes,
    specialites,
    loading,
    error,
    refresh,
    createTypeActe,
    updateTypeActe,
    deleteTypeActe
  } = useTypesActes();

  // --- State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActe, setEditingActe] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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

  const toggleActeStatus = async (acte) => {
    await updateTypeActe(acte.id, { actif: !acte.actif });
  };

  // --- Stats ---
  const stats = useMemo(() => ({
    total: actes.length,
    active: actes.filter(a => a.actif).length,
    inactive: actes.filter(a => !a.actif).length,
  }), [actes]);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.specialite, filters.tarif, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredActes.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * itemsPerPage;
  const paginatedActes = filteredActes.slice(startIdx, startIdx + itemsPerPage);

  const specialiteOptions = [
    { value: '', label: 'Toutes les spécialités' },
    ...specialites.map((spec) => ({ value: spec.id.toString(), label: spec.nom })),
  ];

  // --- UI ---
  if (loading && actes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des types d'actes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 md:px-10 py-8 pb-16">
      <div className="max-w-[1180px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Types d'actes</h1>
            <p className="text-[13px] text-gray-500 mt-1">
              {stats.total} types d'actes au total · {stats.active} actifs
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-[18px] py-2.5 bg-medical-primary text-white rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 14px rgb(var(--medical-primary-rgb) / 0.35)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau type d'acte
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <KpiCard icon={ClipboardList} tone="blue" label="Total" value={stats.total} />
          <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
          <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[14px] p-4 mb-5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-700">{error.message || "Une erreur est survenue."}</p>
          </div>
        )}

        {/* Recherche + filtres */}
        <div className="bg-white border border-gray-200 rounded-[20px] p-4 md:p-5 shadow-sm mb-5 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3.5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 invisible" aria-hidden="true">Recherche</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Rechercher par nom, description…"
                className="w-full border border-gray-200 rounded-[10px] pl-9 pr-9 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary transition-colors"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <Dropdown
            label="Spécialité"
            value={filters.specialite}
            onChange={(v) => setFilters(prev => ({ ...prev, specialite: v || '' }))}
            options={specialiteOptions}
            size="md"
          />
          <Dropdown
            label="Tarif"
            value={filters.tarif}
            onChange={(v) => setFilters(prev => ({ ...prev, tarif: v || '' }))}
            options={TARIF_OPTIONS}
            size="md"
          />
        </div>

        {/* Liste */}
        <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <p className="text-[12.5px] font-semibold text-gray-900">
              {filteredActes.length} type(s) d'acte trouvé(s)
            </p>
            <Dropdown
              value={String(itemsPerPage)}
              onChange={(v) => setItemsPerPage(Number(v))}
              options={PAGE_SIZE_OPTIONS}
              size="sm"
              wrapperClassName="w-40"
            />
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500">Acte</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Tarif</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Durée</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Spécialités</th>
                  <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-gray-500">Ordre</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Statut</th>
                  <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActes.map((acte) => (
                  <tr key={acte.id} className="border-t border-gray-100">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-gray-900 text-[13.5px]">{acte.nom}</p>
                      {acte.description && (
                        <p className="text-gray-400 text-xs mt-0.5 truncate max-w-xs">{acte.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {acte.tarif_defaut > 0 ? (
                        <span className="text-gray-900 font-medium text-[12.5px]">{formatMontant(acte.tarif_defaut)}</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 w-fit">
                          Gratuit
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-[12.5px] font-mono">
                      {formatDuree(acte.duree_estimee)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {acte.specialites_data && acte.specialites_data.length > 0 ? (
                          acte.specialites_data.map(spec => (
                            <span
                              key={spec.id}
                              className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-blue-100 text-blue-700"
                            >
                              {spec.nom}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs italic">Aucune</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500 text-[12.5px]">
                      {acte.ordre_affichage}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleActeStatus(acte)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors ${
                          acte.actif ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ background: acte.actif ? '#047857' : '#9ca3af' }}
                        />
                        {acte.actif ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenModal(acte)}
                          className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(acte.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredActes.length === 0 && (
            <div className="py-16 px-5 text-center">
              <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
              <p className="text-[13px] text-gray-400">Aucun type d'acte ne correspond à ces filtres</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {filteredActes.length === 0
                ? ''
                : `${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filteredActes.length)} sur ${filteredActes.length}`}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:text-gray-300 disabled:cursor-default hover:enabled:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                    n === page ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:text-gray-300 disabled:cursor-default hover:enabled:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary/30 focus:border-medical-primary outline-none transition-all"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary/30 focus:border-medical-primary outline-none transition-all"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary/30 focus:border-medical-primary outline-none transition-all"
              />
            </div>

             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={formData.ordre_affichage}
                onChange={e => setFormData({...formData, ordre_affichage: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary/30 focus:border-medical-primary outline-none transition-all"
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
                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.actif ? 'bg-medical-primary' : 'bg-gray-300'}`}></div>
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
                        formData.specialite_ids.includes(spec.id) ? 'bg-medical-primary border-medical-primary' : 'border-gray-300 bg-white'
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary/30 focus:border-medical-primary outline-none transition-all resize-none"
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
              className="px-6 py-2 text-sm font-medium text-white bg-medical-primary rounded-lg hover:opacity-90 transition-opacity shadow-sm"
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
