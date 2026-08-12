import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Dropdown from '../../components/common/Dropdown';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { Plus, Search, Shield, Edit2, Trash2 } from 'lucide-react';

const TYPES_ASSURANCE = {
  mutuelle: { label: 'IPM / Mutuelle', badge: 'bg-blue-50 text-blue-700' },
  securite_sociale: { label: 'FNR', badge: 'bg-emerald-50 text-emerald-700' },
  privee: { label: 'Privée', badge: 'bg-violet-50 text-violet-700' },
  autre: { label: 'Autre', badge: 'bg-gray-100 text-gray-600' },
};
const TYPE_KEYS = Object.keys(TYPES_ASSURANCE);

const EMPTY_FORM = { nom: '', description: '', type_assurance: 'mutuelle', taux_remboursement: 0, ordre_affichage: 0, actif: true };

const Assurances = () => {
  const [assurances, setAssurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchAssurances();
  }, []);

  const fetchAssurances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assurances')
        .select('*')
        .order('ordre_affichage', { ascending: true });
      if (error) throw error;
      setAssurances(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des assurances:', error);
      unifiedNotificationService.error('Erreur lors du chargement des assurances');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssurances = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return assurances.filter((a) => {
      const matchesSearch = !term || a.nom.toLowerCase().includes(term) || (a.description || '').toLowerCase().includes(term);
      const matchesType = !typeFilter || a.type_assurance === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [assurances, searchTerm, typeFilter]);

  const openAdd = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (assurance) => {
    setEditing(assurance);
    setFormData({
      nom: assurance.nom,
      description: assurance.description || '',
      type_assurance: assurance.type_assurance,
      taux_remboursement: assurance.taux_remboursement,
      ordre_affichage: assurance.ordre_affichage,
      actif: assurance.actif,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim() || saving) return;

    setSaving(true);
    try {
      const payload = {
        nom: formData.nom.trim(),
        description: formData.description.trim() || null,
        type_assurance: formData.type_assurance,
        taux_remboursement: parseFloat(formData.taux_remboursement) || 0,
        ordre_affichage: parseInt(formData.ordre_affichage, 10) || 0,
        actif: formData.actif,
      };

      if (editing) {
        const { error } = await supabase.from('assurances').update(payload).eq('id', editing.id);
        if (error) throw error;
        unifiedNotificationService.success('Assurance modifiée avec succès');
      } else {
        const { error } = await supabase.from('assurances').insert([payload]);
        if (error) throw error;
        unifiedNotificationService.success('Assurance ajoutée avec succès');
      }

      closeModal();
      fetchAssurances();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      unifiedNotificationService.error('Erreur lors de la sauvegarde : ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = async (assurance) => {
    const nextActif = !assurance.actif;
    setAssurances((prev) => prev.map((a) => (a.id === assurance.id ? { ...a, actif: nextActif } : a)));
    try {
      const { error } = await supabase.from('assurances').update({ actif: nextActif }).eq('id', assurance.id);
      if (error) throw error;
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      unifiedNotificationService.error('Erreur lors du changement de statut : ' + error.message);
      setAssurances((prev) => prev.map((a) => (a.id === assurance.id ? { ...a, actif: assurance.actif } : a)));
    }
  };

  const handleDeleteClick = (id) => setDeleteConfirm({ isOpen: true, id });

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('assurances').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      fetchAssurances();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      unifiedNotificationService.error('Erreur lors de la suppression : ' + error.message);
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const typeFilterOptions = [
    { value: '', label: 'Tous les types' },
    ...TYPE_KEYS.map((k) => ({ value: k, label: TYPES_ASSURANCE[k].label })),
  ];
  const typeFormOptions = TYPE_KEYS.map((k) => ({ value: k, label: TYPES_ASSURANCE[k].label }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Assurances</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez les assurances acceptées par le cabinet médical</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-[18px] py-2.5 bg-violet-500 text-white border-none rounded-xl text-sm font-medium cursor-pointer shadow-[0_4px_14px_rgba(139,92,246,.35)] hover:bg-violet-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une assurance
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded-[18px] shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou description…"
            className="w-full border border-gray-200 rounded-[10px] py-2.5 pl-8 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <Dropdown size="md" options={typeFilterOptions} value={typeFilter} onChange={(val) => setTypeFilter(val || '')} />
      </div>

      {/* Liste */}
      <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="m-0 text-sm font-semibold text-gray-900">
            {filteredAssurances.length} assurance{filteredAssurances.length > 1 ? 's' : ''}
          </p>
        </div>

        {filteredAssurances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500">Assurance</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500">Type</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500">Remboursement</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500">Ordre</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500">Statut</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssurances.map((a) => {
                  const type = TYPES_ASSURANCE[a.type_assurance] || TYPES_ASSURANCE.autre;
                  return (
                    <tr key={a.id} className="border-t border-gray-100">
                      <td className="px-5 py-3">
                        <p className="m-0 font-medium text-gray-900">{a.nom}</p>
                        {a.description && <p className="m-0 mt-0.5 text-xs text-gray-400">{a.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${type.badge}`}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {a.taux_remboursement > 0 ? (
                          <span className="text-blue-700">{Number(a.taux_remboursement).toFixed(0)}%</span>
                        ) : (
                          <span className="text-gray-400 font-normal">Non défini</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{a.ordre_affichage}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActif(a)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-colors ${
                            a.actif ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${a.actif ? 'bg-emerald-700' : 'bg-gray-400'}`} />
                          {a.actif ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(a)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-[13px] h-[13px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(a.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-[13px] h-[13px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 px-5 text-center">
            <Shield className="w-7 h-7 text-gray-300 mx-auto mb-2.5" />
            <p className="m-0 text-sm text-gray-400">Aucune assurance ne correspond à ces filtres</p>
          </div>
        )}
      </div>

      {/* Modale ajout / édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? "Modifier l'assurance" : 'Ajouter une assurance'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom *</label>
            <input
              type="text"
              required
              value={formData.nom}
              onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Type</label>
              <Dropdown
                size="md"
                options={typeFormOptions}
                value={formData.type_assurance}
                onChange={(val) => setFormData((prev) => ({ ...prev, type_assurance: val || 'mutuelle' }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Taux remb. (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.taux_remboursement}
                onChange={(e) => setFormData((prev) => ({ ...prev, taux_remboursement: e.target.value }))}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Ordre d'affichage</label>
            <input
              type="number"
              value={formData.ordre_affichage}
              onChange={(e) => setFormData((prev) => ({ ...prev, ordre_affichage: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.actif}
              onChange={(e) => setFormData((prev) => ({ ...prev, actif: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Actif</span>
          </label>

          <div className="flex justify-end gap-2.5 mt-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-none rounded-[10px] text-sm font-medium cursor-pointer transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-[18px] py-2 bg-violet-500 hover:bg-violet-600 text-white border-none rounded-[10px] text-sm font-medium cursor-pointer shadow-[0_4px_14px_rgba(139,92,246,.35)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Supprimer l'assurance"
        message="Êtes-vous sûr de vouloir supprimer cette assurance ? Cette action est irréversible."
        type="error"
        confirmText="Supprimer"
      />
    </div>
  );
};

export default Assurances;
